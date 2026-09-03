import { NextRequest, NextResponse } from "next/server";
import { cleanLeadId, corsHeaders } from "@/lib/leads-intake";
import { appendDocuments, cleanRef } from "@/lib/lead-documents";
import { uploadLeadDocument, storageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Document upload for lead-attached paperwork — FALLBACK PATH.
 *
 * Prefer POST /api/leads/upload-url, which hands the browser a signed URL and
 * lets the bytes go straight to Supabase. This route streams the file through
 * Vercel, which caps request bodies at 4.5MB, so anything larger is rejected by
 * the platform before it ever reaches this handler. Kept because it still works
 * for small files and gives the funnel something to retry with.
 *
 *   POST https://krasadev.com/api/leads/upload
 *   Content-Type: multipart/form-data
 *   file=<binary>  site=refundauto.com  [leadId=<uuid>]  [clientRef=<uuid>]
 *
 * Two-phase by design. RefundAuto's funnel asks for documents FOUR steps before
 * it collects an email, so at upload time there is usually no lead yet. The
 * client generates a `clientRef` UUID when the funnel starts and sends it here;
 * the object is stored under that prefix and the descriptor is returned. When
 * the lead is finally created, the funnel includes the descriptors in
 * `meta.documents` and `meta.clientRef`, which stitches the two together.
 *
 * If a `leadId` IS supplied (a late upload, or a re-upload from the action
 * plan) the descriptor is appended to that lead's `meta.documents` directly.
 *
 * Returns the descriptor, never a URL — the bucket is private and reads go
 * through short-lived signed URLs.
 */

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  if (!storageConfigured()) {
    console.error("[leads/upload] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.json(
      { ok: false, error: "Uploads are not available right now" },
      { status: 503, headers },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400, headers },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Missing file" },
      { status: 400, headers },
    );
  }

  const site = String(form.get("site") || "").trim().slice(0, 100);
  if (!site) {
    return NextResponse.json(
      { ok: false, error: "Missing required field: site" },
      { status: 400, headers },
    );
  }

  const leadId = cleanLeadId(form.get("leadId"));
  const clientRef = cleanRef(form.get("clientRef"));

  // We need somewhere to put it. Prefer the real lead id; fall back to the
  // funnel's client-generated ref.
  const ref = leadId || clientRef;
  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "Provide either leadId or clientRef" },
      { status: 400, headers },
    );
  }

  const result = await uploadLeadDocument({ site, ref, file });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400, headers });
  }

  // Late upload against a known lead: attach it now.
  if (leadId) {
    try {
      await appendDocuments(leadId, [result.doc]);
    } catch (err) {
      // The file is safely stored; losing the pointer is recoverable (the path
      // contains the lead id). Don't fail the user's upload over it.
      console.error("[leads/upload] failed to attach document to lead", err);
    }
  }

  return NextResponse.json({ ok: true, document: result.doc }, { status: 201, headers });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
