import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { sendEmail } from "@/lib/email/client";
import { outcomeEmail } from "@/lib/email/templates";
import { dueOutcomeStep } from "@/lib/email/schedule";
import { EMAIL } from "@/lib/email/config";
import { createToken, tokensConfigured } from "@/lib/email/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Don't email more than this many people in one cron tick. */
const BATCH_LIMIT = 40;

/**
 * Daily: ask people whether their refund actually arrived.
 *
 *   GET /api/cron/outcome-emails      (Vercel cron, Bearer CRON_SECRET)
 *
 * This is the loop the whole business has been missing. `letters-downloaded`
 * has been the terminal event since launch, which means we have never known
 * whether a single dollar was refunded — no proof, no case studies, and no
 * honest basis for pricing.
 *
 * Rules, in order:
 *   - only leads we actually emailed letters to
 *   - stop the moment they answer; we ask three times at most
 *   - never mail someone who unsubscribed
 *   - one step per lead per run, and one step per 30-day window
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!tokensConfigured()) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_TOKEN_SECRET is not set — one-click answers would not verify" },
      { status: 503 },
    );
  }

  const rows = await db.select().from(leads).where(eq(leads.site, "refundauto.com"));
  const now = Date.now();

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const lead of rows) {
    if (sent >= BATCH_LIMIT) break;

    const meta = (lead.meta ?? {}) as Record<string, unknown>;
    const emails = (meta.emails ?? {}) as Record<string, unknown>;
    const lettersSend = emails.letters as { sentAt?: string } | undefined;

    // Never asked → nothing to ask about.
    if (!lettersSend?.sentAt || !lead.email) { skipped++; continue; }
    // Already told us → stop asking. This is the point.
    if (meta.outcome) { skipped++; continue; }
    if (meta.emailUnsubscribedAt) { skipped++; continue; }

    const daysSince = (now - new Date(lettersSend.sentAt).getTime()) / 86400000;
    const already = (emails.outcomeSteps as number[] | undefined) ?? [];

    const due = dueOutcomeStep(daysSince, already);
    if (!due) { skipped++; continue; }

    const outcomeToken = createToken(lead.id, "outcome");
    const unsubToken = createToken(lead.id, "unsubscribe");
    if (!outcomeToken || !unsubToken) { skipped++; continue; }

    const firstName = (lead.name || "").trim().split(/\s+/)[0] || null;
    const msg = outcomeEmail({
      firstName,
      step: due,
      answerUrl: `${EMAIL.origin}/api/outcome/${outcomeToken}`,
      unsubscribeUrl: `${EMAIL.origin}/api/unsubscribe/${unsubToken}`,
    });

    const res = await sendEmail({
      to: lead.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      leadId: lead.id,
      unsubscribable: true,
    });

    if (!res.ok) {
      failures.push(`${lead.id}: ${res.error ?? "unknown"}`);
      continue;
    }

    await db
      .update(leads)
      .set({
        meta: {
          ...meta,
          emails: {
            ...emails,
            outcomeSteps: [...already, due],
            lastOutcomeAt: new Date().toISOString(),
          },
        },
        updated_at: new Date(),
      })
      .where(eq(leads.id, lead.id));

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failures });
}
