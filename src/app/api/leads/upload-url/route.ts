import { NextRequest, NextResponse } from "next/server";
import { cleanLeadId, corsHeaders } from "@/lib/leads-intake";
import { cleanRef } from "@/lib/lead-documents";
import { createSignedUploadUrl, storageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a signed URL the browser can upload a document to directly.
 *
 *   POST https://krasadev.com/api/leads/upload-url
 *   { "site": "refundauto.com", "clientRef": "<uuid>",
 *     "fileName": "contract.pdf", "contentType": "application/pdf", "size": 8123456 }
 *   -> 200 { ok: true, uploadUrl, document: { path, name, size, contentType, uploadedAt } }
 *
 * The client then PUTs the file to `uploadUrl` — straight to Supabase Storage,
 * bypassing Vercel's 4.5MB function body limit entirely. Only this small JSON
 * request goes through our own API.
 *
 * `size` and `contentType` here are the browser's claims and are used for a
 * fast, friendly rejection. The real enforcement is the bucket's
 * `file_size_limit` and `allowed_mime_types`, which Supabase applies when the
 * bytes actually land (supabase/0002_lead_documents.sql).
 *
 * The returned token is scoped to one object path and expires in two hours.
 */
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  if (!storageConfigured()) {
    console.error("[leads/upload-url] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.json(
      { ok: false, error: "Uploads are not available right now" },
      { status: 503, headers },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers },
    );
  }

  const site = String(body.site || "").trim().slice(0, 100);
  if (!site) {
    return NextResponse.json(
      { ok: false, error: "Missing required field: site" },
      { status: 400, headers },
    );
  }

  // Folder key: the real lead when we have one, else the funnel's client ref.
  const ref = cleanLeadId(body.leadId) || cleanRef(body.clientRef);
  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "Provide either leadId or clientRef" },
      { status: 400, headers },
    );
  }

  const fileName = String(body.fileName || "document").trim().slice(0, 200);
  const contentType = String(body.contentType || "").trim();
  const size = Number(body.size);

  if (!Number.isFinite(size)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid size" },
      { status: 400, headers },
    );
  }

  const result = await createSignedUploadUrl({ site, ref, fileName, contentType, size });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400, headers });
  }

  return NextResponse.json(
    { ok: true, uploadUrl: result.uploadUrl, document: result.doc },
    { status: 200, headers },
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
