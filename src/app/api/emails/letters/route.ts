import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { cleanLeadId, corsHeaders, isKnownSite } from "@/lib/leads-intake";
import { signLeadDocument } from "@/lib/storage";
import { sendEmail } from "@/lib/email/client";
import { lettersEmail, type LetterSummary } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK_DAYS = 30;

/**
 * Email a lead the cancellation letters they just generated.
 *
 *   POST /api/emails/letters
 *   { "site": "refundauto.com", "leadId": "<uuid>",
 *     "letters": [ { "title": "...", "recipient": "...", "path": "<storage path>" } ] }
 *
 * Why this exists: before it, letters lived only in the browser's localStorage.
 * 17% of people re-ran the entire funnel, and every one of them was someone who
 * had lost their documents. Emailing them is also the only way we ever get to
 * ask whether the refund arrived.
 *
 * The letter PDFs are uploaded by the funnel through the existing signed-upload
 * flow, so this route only ever sees storage paths — never file bytes, which
 * keeps it well under Vercel's 4.5MB request limit.
 *
 * Idempotent by design: if we have already emailed this lead's letters, we say
 * so and send nothing. A double-submit from a flaky connection should not mean
 * two copies in someone's inbox.
 */
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers });
  }

  const site = String(body.site || "").trim().slice(0, 100);
  const leadId = cleanLeadId(body.leadId);
  if (!isKnownSite(site) || !leadId) {
    return NextResponse.json(
      { ok: false, error: "A known site and a valid leadId are required" },
      { status: 400, headers },
    );
  }

  const rows = Array.isArray(body.letters) ? body.letters : [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No letters provided" }, { status: 400, headers });
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.site !== site) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404, headers });
  }
  if (!lead.email) {
    return NextResponse.json({ ok: false, error: "Lead has no email" }, { status: 400, headers });
  }

  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  const emails = (meta.emails ?? {}) as Record<string, unknown>;
  if (emails.letters) {
    return NextResponse.json({ ok: true, alreadySent: true }, { status: 200, headers });
  }

  // Only sign paths that belong to this lead or its funnel ref — a descriptor
  // comes from the browser, so it cannot be trusted to point anywhere it likes.
  const allowedPrefixes = [`${site}/${leadId}/`];
  const clientRef = typeof meta.clientRef === "string" ? meta.clientRef : null;
  if (clientRef) allowedPrefixes.push(`${site}/${clientRef}/`);

  const letters: LetterSummary[] = [];
  for (const raw of rows.slice(0, 12)) {
    const r = raw as Record<string, unknown>;
    const path = String(r.path || "");
    if (!allowedPrefixes.some((p) => path.startsWith(p))) continue;
    const url = await signLeadDocument(path, LINK_DAYS * 86400);
    if (!url) continue;
    letters.push({
      title: String(r.title || "Cancellation letter").slice(0, 200),
      recipient: String(r.recipient || "the administrator").slice(0, 200),
      url,
      firstStep: typeof r.firstStep === "string" ? r.firstStep.slice(0, 200) : null,
    });
  }

  if (letters.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No letters could be signed" },
      { status: 400, headers },
    );
  }

  const firstName = (lead.name || "").trim().split(/\s+/)[0] || null;
  const msg = lettersEmail({ firstName, letters, linkDays: LINK_DAYS });
  const sent = await sendEmail({
    to: lead.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    leadId,
    // Transactional: they asked for these. No unsubscribe header.
    unsubscribable: false,
  });

  await db
    .update(leads)
    .set({
      meta: {
        ...meta,
        emails: {
          ...emails,
          letters: {
            sentAt: new Date().toISOString(),
            count: letters.length,
            ...(sent.id ? { providerId: sent.id } : {}),
            ...(sent.ok ? {} : { error: sent.error ?? "unknown" }),
          },
        },
      },
      updated_at: new Date(),
    })
    .where(eq(leads.id, leadId));

  return NextResponse.json(
    { ok: sent.ok, sent: letters.length, ...(sent.ok ? {} : { error: sent.error }) },
    { status: sent.ok ? 200 : 502, headers },
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}
