/**
 * Supabase Storage helper for lead-attached documents.
 *
 * Deliberately uses the Storage REST API over `fetch` rather than pulling in
 * `@supabase/supabase-js` — we need exactly three operations (upload, sign,
 * delete) and the repo has no other Supabase-client dependency.
 *
 * The bucket is PRIVATE. Nothing is ever served directly; reads go through
 * short-lived signed URLs. See `supabase/0002_lead_documents.sql`.
 *
 * Required env:
 *   SUPABASE_URL                — https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service_role key (server-only, never NEXT_PUBLIC_)
 * Optional:
 *   SUPABASE_LEAD_DOCS_BUCKET   — defaults to "lead-documents"
 */

import { isKnownSite } from "@/lib/enums";

const BUCKET = process.env.SUPABASE_LEAD_DOCS_BUCKET || "lead-documents";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config(): { url: string; key: string } | null {
  // Trim aggressively: pasting into the Vercel dashboard very easily captures a
  // trailing newline, and a key with stray whitespace fails JWT verification
  // with an error that says nothing about whitespace.
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function storageConfigured(): boolean {
  return config() !== null;
}

/** Legacy service_role keys are JWTs; the 2025+ secret keys (sb_secret_…) are not. */
function isJwt(key: string): boolean {
  return /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(key);
}

/**
 * Auth headers for the Storage API.
 *
 * Supabase now issues two shapes of secret credential and they are NOT
 * interchangeable across headers:
 *
 *  - Legacy `service_role` keys are JWTs. Storage verifies them on
 *    `Authorization: Bearer`, and supabase-js also sends `apikey`.
 *  - The newer `sb_secret_…` keys are opaque, not JWTs. Putting one on
 *    `Authorization: Bearer` makes Storage try to verify it as a JWT and fail
 *    with `"signature verification failed"` — which reads like a wrong key but
 *    is really a wrong header. They belong on `apikey` alone.
 *
 * So: send both for a JWT, `apikey` only for a secret key.
 */
function authHeaders(key: string): Record<string, string> {
  return isJwt(key)
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}

/**
 * Non-secret facts about the configured key, for error logs. Decodes only the
 * JWT payload (which is public, not the signature) to surface the two things
 * that actually go wrong: key is for a different project, or wrong role.
 */
function describeKey(url: string, key: string): string {
  if (!isJwt(key)) return "secret-key format (sb_secret_…), sent on apikey";
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    ) as { ref?: string; role?: string };
    const projectRef = new URL(url).hostname.split(".")[0];
    const match = payload.ref === projectRef ? "matches" : `MISMATCH (url=${projectRef})`;
    return `legacy JWT, role=${payload.role}, ref=${payload.ref} ${match}`;
  } catch {
    return "unparseable JWT — check for truncation or stray whitespace";
  }
}

/** File types we accept from a purchase-paperwork upload. */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — matches the funnel copy

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

/**
 * Strip anything that could escape the intended prefix or confuse the CDN.
 * Keeps a readable stem so the file is still recognisable in the dashboard.
 */
export function safeFileName(name: string, mime: string): string {
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  const ext = EXT_BY_MIME[mime] || "bin";
  return `${stem || "document"}.${ext}`;
}

export interface StoredDocument {
  /** Full object path inside the bucket. */
  path: string;
  /** Original filename as the user had it. */
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

/**
 * Object layout: {site}/{leadId | clientRef}/{timestamp}-{safe-name}
 *
 * Grouping by ref means a lead's documents are already collected in one folder
 * before the lead row exists.
 *
 * Both `site` and `ref` are caller-supplied, so both are checked before they
 * become path segments: `site` must be one of the known SITES (the lead intake
 * itself is lax about this, but a storage prefix is not the place to be), and
 * `ref` must be a UUID. Without that, a `site` of "../.." would write outside
 * the intended prefix.
 */
export function buildObjectPath(
  site: string,
  ref: string,
  fileName: string,
  mime: string,
): string | null {
  if (!isKnownSite(site)) return null;
  if (!UUID_RE.test(ref)) return null;
  return `${site}/${ref}/${Date.now()}-${safeFileName(fileName, mime)}`;
}

/** Shared validation for both the proxied and the signed-URL upload paths. */
export function validateUpload(opts: {
  contentType: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(opts.contentType)) {
    return { ok: false, error: `Unsupported file type: ${opts.contentType}` };
  }
  if (opts.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is larger than 20MB" };
  }
  if (opts.size <= 0) {
    return { ok: false, error: "File is empty" };
  }
  return { ok: true };
}

/**
 * Mint a one-shot signed URL the BROWSER can PUT a file to directly.
 *
 * This is the primary upload path. Vercel Functions cap request bodies at
 * 4.5MB, and a phone photo of a retail installment contract routinely exceeds
 * that — routing the bytes through our own API would 413 on exactly the files
 * we most want. With a signed URL the bytes go straight from the customer's
 * browser to Supabase Storage and never touch Vercel.
 *
 * Supabase enforces the bucket's `file_size_limit` and `allowed_mime_types`
 * server-side (see supabase/0002_lead_documents.sql), so the token cannot be
 * used to push something oversized or of the wrong type. Tokens are valid for
 * two hours and are scoped to this exact object path.
 *
 * The client-side counterpart is `uploadToSignedUrl` in refundguy's lib/leads.
 */
export async function createSignedUploadUrl(opts: {
  site: string;
  ref: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<
  | { ok: true; uploadUrl: string; doc: StoredDocument }
  | { ok: false; error: string; status?: number }
> {
  const cfg = config();
  if (!cfg) return { ok: false, error: "Storage is not configured" };

  const valid = validateUpload({ contentType: opts.contentType, size: opts.size });
  if (!valid.ok) return valid;

  const path = buildObjectPath(opts.site, opts.ref, opts.fileName, opts.contentType);
  if (!path) return { ok: false, error: "Unknown site or invalid reference" };

  const res = await fetch(
    `${cfg.url}/storage/v1/object/upload/sign/${BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(cfg.key),
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      "[storage] sign-upload failed",
      res.status,
      detail,
      "| key:",
      describeKey(cfg.url, cfg.key),
      "| bucket:",
      BUCKET,
    );
    // Surface the upstream status so this is diagnosable without digging
    // through Vercel logs. 404 = bucket missing (run
    // supabase/0002_lead_documents.sql); 400/401/403 = bad service_role key or
    // wrong SUPABASE_URL. The response body is logged, not returned — it can
    // echo internals.
    return {
      ok: false,
      error: `Could not start the upload (storage ${res.status})`,
      status: res.status,
    };
  }

  // Supabase returns a relative URL carrying the token:
  //   { "url": "/object/upload/sign/{bucket}/{path}?token=eyJ..." }
  const data = (await res.json().catch(() => null)) as { url?: string } | null;
  if (!data?.url) {
    console.error("[storage] sign-upload returned no url");
    return { ok: false, error: "Could not start the upload" };
  }

  return {
    ok: true,
    uploadUrl: `${cfg.url}/storage/v1${data.url}`,
    doc: {
      path,
      name: opts.fileName.slice(0, 200),
      size: opts.size,
      contentType: opts.contentType,
      uploadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Upload one document THROUGH this server.
 *
 * Fallback path only — prefer `createSignedUploadUrl`. Anything over ~4.5MB
 * will be rejected by Vercel before it reaches this function, so this exists
 * for small files and for callers that can't do a two-step upload.
 *
 * `ref` is the folder key: the lead's UUID once it exists, or the funnel's
 * `clientRef` when the file arrives before the lead is created (the RefundAuto
 * upload step runs four questions ahead of the contact step). Storing under
 * clientRef means the objects are already grouped when the lead lands, and the
 * lead's `meta.documents` array carries the paths.
 */
export async function uploadLeadDocument(opts: {
  site: string;
  ref: string;
  file: File;
}): Promise<{ ok: true; doc: StoredDocument } | { ok: false; error: string }> {
  const cfg = config();
  if (!cfg) return { ok: false, error: "Storage is not configured" };

  const { site, ref, file } = opts;
  const contentType = file.type || "application/octet-stream";

  const valid = validateUpload({ contentType, size: file.size });
  if (!valid.ok) return valid;

  const path = buildObjectPath(site, ref, file.name, contentType);
  if (!path) return { ok: false, error: "Unknown site or invalid reference" };

  const res = await fetch(
    `${cfg.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(cfg.key),
        "Content-Type": contentType,
        "x-upsert": "false",
        "cache-control": "3600",
      },
      body: await file.arrayBuffer(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[storage] upload failed", res.status, detail);
    return { ok: false, error: "Upload failed" };
  }

  return {
    ok: true,
    doc: {
      path,
      name: file.name.slice(0, 200),
      size: file.size,
      contentType,
      uploadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mint a short-lived read URL for a stored object. Used when surfacing a lead's
 * documents in Slack or an internal view — never handed to the public.
 */
export async function signLeadDocument(
  path: string,
  expiresInSeconds = 60 * 60 * 24 * 7,
): Promise<string | null> {
  const cfg = config();
  if (!cfg) return null;

  const res = await fetch(
    `${cfg.url}/storage/v1/object/sign/${BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(cfg.key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );

  if (!res.ok) {
    console.error("[storage] sign failed", res.status);
    return null;
  }

  const data = (await res.json().catch(() => null)) as { signedURL?: string } | null;
  return data?.signedURL ? `${cfg.url}/storage/v1${data.signedURL}` : null;
}
