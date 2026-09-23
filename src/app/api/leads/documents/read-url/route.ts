import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isKnownSite } from "@/lib/enums";
import { signLeadDocument } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short-lived READ URLs for uploaded lead documents — server-to-server only.
 *
 *   POST https://krasadev.com/api/leads/documents/read-url
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 *   { "paths": ["refundauto.com/<uuid>/<file>", ...] }
 *   -> 200 { ok: true, urls: { "<path>": "https://…signed…" } }
 *
 * Used by refundauto.com's document-analysis workflow, which runs on
 * refundauto's own servers and needs to read the customer's paperwork. The
 * bucket stays private: nothing here is reachable from a browser (no CORS
 * headers, and the shared secret never leaves either server).
 *
 * Every path must be `{known site}/{uuid}/{file}` — the same shape the upload
 * routes produce — so the secret can't be used to read arbitrary objects.
 * URLs live 10 minutes: long enough for a model call, short enough that a
 * leaked log line is useless by the time anyone reads it.
 */
const PATH_RE = /^([a-z0-9.-]+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+$/i;
const MAX_PATHS = 12;
const TTL_SECONDS = 600;

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) return false;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  if (paths.length === 0 || paths.length > MAX_PATHS) {
    return NextResponse.json({ ok: false, error: `Provide 1–${MAX_PATHS} paths` }, { status: 400 });
  }

  const bad = paths.filter((p) => {
    const m = PATH_RE.exec(p);
    return !m || !isKnownSite(m[1]) || p.includes("..");
  });
  if (bad.length) {
    return NextResponse.json({ ok: false, error: "Invalid path", bad }, { status: 400 });
  }

  const urls: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      const url = await signLeadDocument(p, TTL_SECONDS);
      if (url) urls[p] = url;
    }),
  );

  return NextResponse.json({ ok: true, urls });
}
