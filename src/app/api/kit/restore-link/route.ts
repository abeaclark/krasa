import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { corsHeaders, isKnownSite } from "@/lib/leads-intake";
import { sendEmail } from "@/lib/email/client";
import { restoreEmail } from "@/lib/email/templates";
import { createToken, tokensConfigured } from "@/lib/email/tokens";
import { EMAIL } from "@/lib/email/config";
import { bestLeadForEmail } from "@/lib/kitRestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK_HOURS = 24;
/** Don't send the same inbox more than one link a minute. */
const MIN_GAP_MS = 60_000;

/**
 * "Get back to your kit": email a sign-in link to someone's cancellation kit.
 *
 *   POST /api/kit/restore-link  { site, email }  ->  { ok: true }
 *
 * Always answers the same way, whether or not we know the address, so the
 * form can't be used to find out who is a customer. The link only ever goes
 * to the email on the lead — opening it is the proof of owning that inbox.
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
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  if (!isKnownSite(site) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email" }, { status: 400, headers });
  }
  if (!tokensConfigured()) {
    return NextResponse.json({ ok: false, error: "Not available right now" }, { status: 503, headers });
  }

  const lead = await bestLeadForEmail(site, email);
  if (lead?.email) {
    const meta = (lead.meta ?? {}) as Record<string, unknown>;
    const restore = (meta.restore ?? {}) as { lastSentAt?: string; count?: number };
    const recent = restore.lastSentAt && Date.now() - new Date(restore.lastSentAt).getTime() < MIN_GAP_MS;
    const token = createToken(lead.id, "restore", LINK_HOURS / 24);
    if (!recent && token) {
      const msg = restoreEmail({
        firstName: (lead.name || "").trim().split(/\s+/)[0] || null,
        url: `${EMAIL.origin}/restore?t=${encodeURIComponent(token)}`,
        hours: LINK_HOURS,
      });
      const sent = await sendEmail({ to: lead.email, subject: msg.subject, html: msg.html, text: msg.text, leadId: lead.id });
      await db
        .update(leads)
        .set({
          meta: { ...meta, restore: { lastSentAt: new Date().toISOString(), count: (restore.count ?? 0) + 1, ...(sent.ok ? {} : { error: sent.error ?? "unknown" }) } },
          updated_at: new Date(),
        })
        .where(eq(leads.id, lead.id));
    }
  }
  return NextResponse.json({ ok: true }, { status: 200, headers });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}
