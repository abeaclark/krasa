#!/usr/bin/env node
/**
 * One-off migration: copy the `lead-documents` bucket from a SOURCE Supabase
 * project into the DESTINATION project named by .env.
 *
 * Why this exists: production's SUPABASE_URL had drifted to a different
 * Supabase project than DATABASE_URL, so customer paperwork was landing in
 * project `brnjsuxatcvyvybrqayz` while every lead row lived in
 * `hrzvqnjikgqcmnhucfbf`. The lead's `meta.documents[].path` is project-
 * agnostic, so copying every object to the same key in the destination makes
 * all existing descriptors resolve again. Nothing in the DB changes.
 *
 * Usage:
 *   SRC_URL=https://<old-ref>.supabase.co \
 *   SRC_KEY=<old project's service_role / secret key> \
 *   node scripts/migrate-lead-documents.mjs [--dry-run] [--force]
 *
 * Destination comes from .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 *   --dry-run  list what would be copied, transfer nothing
 *   --force    overwrite objects that already exist in the destination
 *
 * Safe by default: never deletes or modifies anything in the source, and skips
 * any destination object that already exists unless --force is passed.
 * Re-runnable — a second run with no flags copies only what's missing.
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const BUCKET = "lead-documents";

// ---------------------------------------------------------------- env

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const m of fs.readFileSync(file, "utf8").matchAll(/^(\w+)=(.*)$/gm)) {
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (v) out[m[1]] = v; // last non-empty assignment wins
  }
  return out;
}

const env = loadEnv(path.join(process.cwd(), ".env"));
const SRC_URL = (process.env.SRC_URL || "").trim().replace(/\/+$/, "");
const SRC_KEY = (process.env.SRC_KEY || "").trim();
const DST_URL = (process.env.SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const DST_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!SRC_URL || !SRC_KEY) {
  console.error("Set SRC_URL and SRC_KEY to the OLD project's URL and service_role/secret key.");
  process.exit(1);
}
if (!DST_URL || !DST_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (destination) in .env.");
  process.exit(1);
}
if (SRC_URL === DST_URL) {
  console.error("Source and destination are the same project. Nothing to do.");
  process.exit(1);
}

/**
 * Supabase issues two shapes of secret credential and they are NOT
 * interchangeable across headers — legacy service_role keys are JWTs that
 * Storage verifies on `Authorization: Bearer`, while the newer `sb_secret_…`
 * keys are opaque and belong on `apikey` alone. Mirrors src/lib/storage.ts.
 */
const isJwt = (k) => /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(k);
const auth = (k) => (isJwt(k) ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k });

const SRC_H = auth(SRC_KEY);
const DST_H = auth(DST_KEY);

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

// ---------------------------------------------------------------- listing

/**
 * Storage's list endpoint is one level deep per call, so walk the tree.
 * A folder comes back with `id: null`; a real object carries metadata.
 */
async function listAll(prefix = "", depth = 0) {
  if (depth > 6) return [];
  const r = await http(`${SRC_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...SRC_H, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!r.ok) throw new Error(`list ${prefix || "/"} → ${r.status} ${await r.text()}`);
  const rows = await r.json();
  const out = [];
  for (const row of rows) {
    const full = prefix ? `${prefix}${row.name}` : row.name;
    if (row.id) {
      out.push({
        path: full,
        size: row.metadata?.size ?? null,
        mime: row.metadata?.mimetype ?? null,
        createdAt: row.created_at ?? null,
      });
    } else {
      out.push(...(await listAll(`${full}/`, depth + 1)));
    }
  }
  return out;
}

async function existsInDst(p) {
  // HEAD on the object endpoint: 200 when present, 400/404 when not.
  const r = await http(`${DST_URL}/storage/v1/object/${BUCKET}/${enc(p)}`, {
    method: "HEAD",
    headers: DST_H,
  });
  return r.status === 200;
}

async function copyOne(o) {
  const get = await http(`${SRC_URL}/storage/v1/object/${BUCKET}/${enc(o.path)}`, { headers: SRC_H });
  if (!get.ok) throw new Error(`download → ${get.status} ${await get.text()}`);
  const body = Buffer.from(await get.arrayBuffer());
  if (o.size != null && body.byteLength !== Number(o.size)) {
    throw new Error(`size mismatch: listed ${o.size}, downloaded ${body.byteLength}`);
  }
  const put = await http(`${DST_URL}/storage/v1/object/${BUCKET}/${enc(o.path)}`, {
    method: "POST",
    headers: {
      ...DST_H,
      "Content-Type": o.mime || get.headers.get("content-type") || "application/octet-stream",
      // `x-upsert` is what lets --force replace an existing key.
      ...(FORCE ? { "x-upsert": "true" } : {}),
    },
    body,
  });
  if (!put.ok) throw new Error(`upload → ${put.status} ${await put.text()}`);
  return body.byteLength;
}

// ---------------------------------------------------------------- run

const srcRef = new URL(SRC_URL).host.split(".")[0];
const dstRef = new URL(DST_URL).host.split(".")[0];
console.log(`source      ${srcRef}`);
console.log(`destination ${dstRef}`);
console.log(`mode        ${DRY ? "dry run" : FORCE ? "copy, overwriting" : "copy, skipping existing"}\n`);

const objects = await listAll();
const totalMb = objects.reduce((a, b) => a + Number(b.size || 0), 0) / 1e6;
console.log(`${objects.length} objects, ${totalMb.toFixed(1)} MB\n`);

const byPrefix = {};
for (const o of objects) {
  const site = o.path.split("/")[0];
  byPrefix[site] = (byPrefix[site] || 0) + 1;
}
console.log("by site:", byPrefix, "\n");

let copied = 0, skipped = 0, failed = 0, bytes = 0;
const failures = [];

for (const [i, o] of objects.entries()) {
  const tag = `[${String(i + 1).padStart(3)}/${objects.length}]`;
  try {
    if (!FORCE && (await existsInDst(o.path))) {
      skipped++;
      console.log(`${tag} skip (exists)  ${o.path}`);
      continue;
    }
    if (DRY) {
      console.log(`${tag} would copy     ${o.path}  ${((o.size || 0) / 1e6).toFixed(2)} MB`);
      copied++;
      continue;
    }
    const n = await copyOne(o);
    bytes += n;
    copied++;
    console.log(`${tag} copied         ${o.path}  ${(n / 1e6).toFixed(2)} MB`);
  } catch (err) {
    failed++;
    failures.push({ path: o.path, error: String(err.message || err) });
    console.error(`${tag} FAILED         ${o.path}  ${err.message || err}`);
  }
}

console.log(
  `\n${DRY ? "would copy" : "copied"} ${copied}  ·  skipped ${skipped}  ·  failed ${failed}` +
    (DRY ? "" : `  ·  ${(bytes / 1e6).toFixed(1)} MB transferred`),
);

if (failures.length) {
  fs.writeFileSync("migrate-lead-documents.failures.json", JSON.stringify(failures, null, 2));
  console.log("failures written to migrate-lead-documents.failures.json");
  process.exit(1);
}
