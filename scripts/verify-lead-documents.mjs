#!/usr/bin/env node
/**
 * Acceptance check for lead-document storage.
 *
 * Reads every `meta.documents[].path` out of the leads table and HEADs it in
 * the bucket named by .env. A descriptor that doesn't resolve means the lead
 * row promises paperwork the app cannot actually serve — which is exactly the
 * state the project-drift bug left everything in.
 *
 * Usage:
 *   node scripts/verify-lead-documents.mjs [--site refundauto.com] [--verbose]
 *
 * Exits non-zero if any descriptor is missing, so it can gate a deploy.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const siteArg = args.indexOf("--site");
const SITE = siteArg !== -1 ? args[siteArg + 1] : null;

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const m of fs.readFileSync(file, "utf8").matchAll(/^(\w+)=(.*)$/gm)) {
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (v) out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(path.join(process.cwd(), ".env")), ...process.env };
const URL_ = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BUCKET = (env.SUPABASE_LEAD_DOCS_BUCKET || "lead-documents").trim();
if (!URL_ || !KEY || !env.DATABASE_URL) {
  console.error("Need DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.");
  process.exit(1);
}

const isJwt = (k) => /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(k);
const H = isJwt(KEY) ? { apikey: KEY, Authorization: `Bearer ${KEY}` } : { apikey: KEY };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Supabase sits behind Cloudflare, which closes idle keep-alive sockets; undici
 * reuses them and throws UND_ERR_SOCKET mid-run. Retrying on a fresh socket is
 * the whole fix — without it a long run dies a few dozen requests in.
 */
async function http(url, opts = {}, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await globalThis.fetch(url, { ...opts, keepalive: false });
    } catch (err) {
      last = err;
      await sleep(300 * (i + 1));
    }
  }
  throw last;
}

const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

const { default: postgres } = await import("postgres");
const sql = postgres(env.DATABASE_URL, { ssl: "require", prepare: false });

const rows = SITE
  ? await sql`select id, site, name, email, created_at, meta from leads where site = ${SITE} order by created_at desc`
  : await sql`select id, site, name, email, created_at, meta from leads order by created_at desc`;

const checks = [];
for (const r of rows) {
  const docs = Array.isArray(r.meta?.documents) ? r.meta.documents : [];
  for (const d of docs) if (d?.path) checks.push({ lead: r, doc: d });
}

console.log(`bucket   ${new URL(URL_).host.split(".")[0]} / ${BUCKET}`);
console.log(`leads    ${rows.length}${SITE ? ` (site = ${SITE})` : ""}`);
console.log(`docs     ${checks.length} descriptors across ${new Set(checks.map((c) => c.lead.id)).size} leads\n`);

let ok = 0;
const missing = [];
const mismatched = [];

for (const c of checks) {
  const r = await http(`${URL_}/storage/v1/object/${BUCKET}/${enc(c.doc.path)}`, { method: "HEAD", headers: H });
  if (r.status !== 200) {
    missing.push({ lead: c.lead.id, name: c.lead.name, path: c.doc.path, status: r.status });
    console.log(`MISSING  ${c.doc.path}`);
    continue;
  }
  const len = Number(r.headers.get("content-length"));
  if (c.doc.size != null && Number.isFinite(len) && len !== Number(c.doc.size)) {
    mismatched.push({ path: c.doc.path, listed: c.doc.size, actual: len });
    console.log(`SIZE     ${c.doc.path}  descriptor ${c.doc.size} vs stored ${len}`);
    continue;
  }
  ok++;
  if (VERBOSE) console.log(`ok       ${c.doc.path}  ${(len / 1e6).toFixed(2)} MB`);
}

// Leads that claim an upload happened but carry no descriptor at all: the older
// funnel only recorded `uploadedDocs` + `uploadedFileName` + `clientRef`, so
// their bytes can only be found by listing the clientRef folder.
const orphans = rows.filter(
  (r) => (r.meta?.uploadedDocs || r.meta?.uploadedFileName) && !Array.isArray(r.meta?.documents),
);

// For the pre-descriptor leads, the bytes (if any) sit under the lead's own
// folder, so probe that prefix directly instead of a known path.
let orphanFound = 0;
async function listPrefix(prefix) {
  const r = await http(`${URL_}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  if (!r.ok) return [];
  return (await r.json()).filter((x) => x.id);
}

console.log(`\nresolved ${ok} / ${checks.length}`);
if (mismatched.length) console.log(`size mismatches ${mismatched.length}`);
if (missing.length) console.log(`missing ${missing.length}`);
if (orphans.length) {
  console.log(
    `\n${orphans.length} leads flag an upload but have no documents[] descriptor ` +
      `(pre-descriptor funnel — look under {site}/{clientRef}/):`,
  );
  for (const o of orphans) {
    const ref = o.meta?.clientRef || o.id;
    const found = await listPrefix(`${o.site}/${ref}/`);
    if (found.length) orphanFound++;
    console.log(
      `  ${o.created_at.toISOString().slice(0, 10)}  ${(o.name || "").padEnd(24)}  ` +
        `${found.length ? `${found.length} file(s) found` : "NOT FOUND"}  ` +
        `under ${o.site}/${ref}/  (${o.meta?.uploadedFileName || "—"})`,
    );
  }
  console.log(`\n${orphanFound} / ${orphans.length} pre-descriptor leads have bytes in the bucket`);
}

await sql.end();
if (missing.length || mismatched.length) process.exit(1);
