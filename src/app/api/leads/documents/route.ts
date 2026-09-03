import { NextRequest, NextResponse } from "next/server";
import { cleanLeadId, corsHeaders, isKnownSite } from "@/lib/leads-intake";
import { appendDocuments, cleanRef, sanitizeDocument } from "@/lib/lead-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Attach already-uploaded document descriptors to an existing lead.
 *
 *   POST https://krasadev.com/api/leads/documents
 *   { "site": "refundauto.com", "leadId": "<uuid>", "clientRef": "<uuid>",
 *     "documents": [ { path, name, size, contentType, uploadedAt } ] }
 *
 * Only needed when the lead ALREADY exists at upload time — a late upload, or a
 * re-upload from the action plan. In the normal funnel the document is uploaded
 * four steps before the contact form, so the descriptors ride along in the
 * lead's own `meta.documents` at creation and this route is never called.
 *
 * Descriptors come from the browser, so `sanitizeDocument` reshapes them and
 * rejects any path outside the lead's or clientRef's own folder. Attaching is
 * idempotent by path.
 */
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers },
    );
  }

  // `site` becomes half of the allowed path prefix below, so it must be a known
  // site — not just any non-empty string.
  const site = String(body.site || "").trim().slice(0, 100);
  const leadId = cleanLeadId(body.leadId);
  if (!isKnownSite(site) || !leadId) {
    return NextResponse.json(
      { ok: false, error: "A known site and a valid leadId are required" },
      { status: 400, headers },
    );
  }

  // A descriptor is only acceptable if it points inside a folder this caller
  // could have written to: the lead's own, or the clientRef it uploaded under.
  const clientRef = cleanRef(body.clientRef);
  const prefixes = [`${site}/${leadId}/`];
  if (clientRef) prefixes.push(`${site}/${clientRef}/`);

  const raw = Array.isArray(body.documents) ? body.documents : [];
  const docs = raw
    .map((d) => sanitizeDocument(d, prefixes))
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (docs.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid documents provided" },
      { status: 400, headers },
    );
  }

  try {
    const { attached } = await appendDocuments(leadId, docs);
    return NextResponse.json({ ok: true, attached }, { status: 200, headers });
  } catch (err) {
    console.error("[leads/documents] failed to attach", err);
    return NextResponse.json(
      { ok: false, error: "Failed to attach documents" },
      { status: 500, headers },
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
