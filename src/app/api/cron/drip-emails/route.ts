import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { sendEmail } from "@/lib/email/client";
import { dripEmail, paperworkEmail, checkoutEmail } from "@/lib/email/templates";
import { dueDripStep, dripState, duePaperworkStep, paperState, dueCheckoutEmail, subjectVariant, OFFER_HOURS, EARLY_OFFER_HOURS, dripPercentOff, reusableDripOffer, type DripOffer, type DripStep } from "@/lib/email/drip";
import { EMAIL } from "@/lib/email/config";
import { createToken, tokensConfigured } from "@/lib/email/tokens";
import { refreshLeadCard } from "@/lib/slack";
import { PRODUCT, slugName } from "@/lib/slackLeadCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 50;
/** Keep in step with refundguy PRICING.letterKit.price. */
const KIT_PRICE = 19;

/**
 * Every 30 minutes: the "didn't pay" drip for RefundAuto, one
 * abandoned-checkout email, and the
 * "get your paperwork" reminders for people with no kit yet (lib/email/drip.ts).
 *
 *   GET /api/cron/drip-emails   (Vercel cron, Bearer CRON_SECRET)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!tokensConfigured()) {
    return NextResponse.json({ ok: false, error: "EMAIL_TOKEN_SECRET is not set" }, { status: 503 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 14 * 86400_000);
  const rows = (await db.select().from(leads).where(eq(leads.site, "refundauto.com"))).filter((l) => l.created_at >= since);

  let sent = 0;
  const skipped: Record<string, number> = {};
  const failures: string[] = [];

  // People re-run the funnel, so one person can have several leads. Treat
  // them as one: if ANY of their leads paid, downloaded, got their letters
  // emailed or already started the drip, the person is done/handled — and
  // only their newest lead is ever emailed.
  const byEmail = new Map<string, typeof rows>();
  for (const l of rows) {
    if (!l.email) continue;
    const k = l.email.trim().toLowerCase();
    byEmail.set(k, [...(byEmail.get(k) ?? []), l]);
  }
  const allRecent = await db.select().from(leads).where(eq(leads.site, "refundauto.com"));
  const handled = new Set<string>();
  for (const l of allRecent) {
    if (!l.email) continue;
    const m = (l.meta ?? {}) as Record<string, unknown>;
    const st = Array.isArray(m._stages) ? (m._stages as { stage?: string }[]).map((x) => x.stage) : [];
    const em = (m.emails ?? {}) as Record<string, unknown>;
    if (m.purchase || m.emailUnsubscribedAt || em.letters || st.includes("letters-downloaded")) handled.add(l.email.trim().toLowerCase());
  }
  const candidates = [...byEmail.entries()]
    .filter(([email]) => !handled.has(email))
    .map(([, ls]) => {
      // The lead the drip already runs on, else the newest.
      const withDrip = ls.find((l) => dripState((l.meta ?? {}) as Record<string, unknown>).sent.length > 0);
      return withDrip ?? ls.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
    });

  for (const lead of candidates) {
    if (sent >= BATCH_LIMIT) break;
    const meta = (lead.meta ?? {}) as Record<string, unknown>;
    // Clicked buy and didn't pay: one reminder, in place of the drip's next email.
    if ("send" in dueCheckoutEmail({ meta, createdAt: new Date(lead.created_at), hasEmail: !!lead.email, now })) {
      if (await sendCheckoutEmail(lead, meta, now, failures)) sent++;
      continue;
    }
    const decision = dueDripStep({ meta, createdAt: new Date(lead.created_at), hasEmail: !!lead.email, now });
    if ("skip" in decision) {
      // Nothing to sell them — but maybe they're waiting on their paperwork.
      const paper = duePaperworkStep({ meta, createdAt: new Date(lead.created_at), hasEmail: !!lead.email, now });
      if ("step" in paper) {
        const ok = await sendPaperworkReminder(lead, meta, paper.step, now, failures);
        if (ok) sent++;
        continue;
      }
      skipped[decision.skip] = (skipped[decision.skip] ?? 0) + 1;
      continue;
    }
    const step: DripStep = decision.step;

    const kitToken = createToken(lead.id, "restore", 7);
    const unsubToken = createToken(lead.id, "unsubscribe");
    if (!kitToken || !unsubToken) continue;
    const variant = subjectVariant(lead.id);
    const kitUrl = `${EMAIL.origin}/restore?t=${encodeURIComponent(kitToken)}&utm_source=email&utm_campaign=drip-${step}-${variant}`;

    const previous = dripState(meta).offer;
    const offer = reusableDripOffer(previous, step, now) ? previous! : await mintOffer(lead.id, dripPercentOff(step), step === "offer" ? OFFER_HOURS : EARLY_OFFER_HOURS);
    if (!offer) {
      failures.push(`${lead.id}: offer code`);
      continue;
    }

    const msg = dripEmail(step, {
      firstName: (lead.name || "").trim().split(/\s+/)[0] || null,
      estimate: estimate(meta),
      products: productLines(meta),
      firstSteps: ((meta.plan as { firstSteps?: string[] } | undefined)?.firstSteps ?? []).slice(0, 6),
      fullRefundUntil: fullRefundUntil(meta, now),
      kitUrl,
      hasPlan: !!meta.plan,
      variant,
      unsubscribeUrl: `${EMAIL.origin}/api/unsubscribe/${unsubToken}`,
      offer: offer
        ? {
            code: offer.code,
            percentOff: offer.percentOff!,
            expires: formatDate(new Date(offer.expiresAt)),
            url: `${kitUrl}&offer=${encodeURIComponent(offer.code)}`,
            price: `$${(KIT_PRICE * (1 - offer.percentOff! / 100)).toFixed(2)}`,
            fullPrice: `$${KIT_PRICE}`,
          }
        : null,
    });

    if (!(await canSendMarketing(lead, failures))) continue;
    const res = await sendEmail({
      to: lead.email!,
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

    const emails = (meta.emails ?? {}) as Record<string, unknown>;
    const drip = dripState(meta);
    const nextMeta = {
      ...meta,
      emails: {
        ...emails,
        drip: { sent: [...drip.sent, { step, at: now.toISOString(), variant }], offer: offer ?? drip.offer ?? null },
      },
    };
    await recordEmails(lead, { drip: nextMeta.emails.drip }, now);
    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failures });
}

/** The one "it may be easier than you think" email; records it on the lead and refreshes the Slack card. */
async function sendCheckoutEmail(
  lead: typeof leads.$inferSelect,
  meta: Record<string, unknown>,
  now: Date,
  failures: string[],
): Promise<boolean> {
  const kitToken = createToken(lead.id, "restore", 7);
  const unsubToken = createToken(lead.id, "unsubscribe");
  if (!kitToken || !unsubToken) return false;
  const msg = checkoutEmail({
    firstName: (lead.name || "").trim().split(/\s+/)[0] || null,
    estimate: estimate(meta),
    products: productLines(meta),
    price: `$${KIT_PRICE}`,
    kitUrl: `${EMAIL.origin}/restore?t=${encodeURIComponent(kitToken)}&utm_source=email&utm_campaign=checkout-abandon`,
    unsubscribeUrl: `${EMAIL.origin}/api/unsubscribe/${unsubToken}`,
  });
  // Re-checks Stripe: never email someone whose payment went through.
  if (!(await canSendMarketing(lead, failures))) return false;
  const res = await sendEmail({ to: lead.email!, subject: msg.subject, html: msg.html, text: msg.text, leadId: lead.id, unsubscribable: true });
  if (!res.ok) {
    failures.push(`${lead.id}: ${res.error ?? "unknown"}`);
    return false;
  }
  const drip = dripState(meta);
  const at = now.toISOString();
  await recordEmails(lead, {
    checkout: { at },
    drip: { sent: drip.sent.length ? drip.sent : [{ step: "ready", at }], offer: drip.offer ?? null },
  }, now);
  return true;
}

/** One "get your paperwork" reminder; records it on the lead and refreshes the Slack card. */
async function sendPaperworkReminder(
  lead: typeof leads.$inferSelect,
  meta: Record<string, unknown>,
  step: import("@/lib/email/drip").PaperStep,
  now: Date,
  failures: string[],
): Promise<boolean> {
  const token = createToken(lead.id, "restore", 7);
  const unsubToken = createToken(lead.id, "unsubscribe");
  if (!token || !unsubToken) return false;
  const plan = meta.plan as { paperworkWaiting?: string[] } | undefined;
  const dealer = ((meta.docFacts as { dealer?: { name?: string; phone?: string | null } | null } | undefined)?.dealer ??
    (meta.dealer as { name?: string; phone?: string | null } | undefined)) ?? null;
  const msg = paperworkEmail(step, {
    firstName: (lead.name || "").trim().split(/\s+/)[0] || null,
    estimate: estimate(meta),
    products: plan?.paperworkWaiting ?? [],
    dealerName: dealer?.name ?? null,
    dealerPhone: dealer?.phone ?? null,
    uploadUrl: `${EMAIL.origin}/restore?t=${encodeURIComponent(token)}&next=upload&utm_source=email&utm_campaign=${step}`,
    unsubscribeUrl: `${EMAIL.origin}/api/unsubscribe/${unsubToken}`,
  });
  if (!(await canSendMarketing(lead, failures))) return false;
  const res = await sendEmail({ to: lead.email!, subject: msg.subject, html: msg.html, text: msg.text, leadId: lead.id, unsubscribable: true });
  if (!res.ok) {
    failures.push(`${lead.id}: ${res.error ?? "unknown"}`);
    return false;
  }
  const emails = (meta.emails ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...meta,
    emails: { ...emails, paperwork: { sent: [...paperState(meta).sent, { step, at: now.toISOString() }] } },
  };
  await recordEmails(lead, { paperwork: nextMeta.emails.paperwork }, now);
  return true;
}

/** Ask refundauto.com (which holds the Stripe key) for a single-use code. */
async function mintOffer(leadId: string, percentOff: 20 | 50, hours: number): Promise<DripOffer | null> {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) return null;
  try {
    const res = await fetch(process.env.KIT_PROMO_ENDPOINT || `${EMAIL.origin}/api/internal/promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ leadId, percentOff, hours }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string; expiresAt?: string };
    return data.ok && data.code && data.expiresAt ? { code: data.code, expiresAt: data.expiresAt, percentOff } : null;
  } catch (err) {
    console.error("[drip] promo mint failed", err);
    return null;
  }
}

/** Stop even if the buyer closed Stripe before our browser callback recorded the sale.
 * Fail closed: a payment-service outage postpones marketing rather than mailing buyers. */
async function canSendMarketing(lead: typeof leads.$inferSelect, failures: string[]): Promise<boolean> {
  const [blocked] = await db.select({ id: leads.id }).from(leads).where(sql`${leads.site} = 'refundauto.com' and (${leads.id} = ${lead.id} or lower(trim(${leads.email})) = ${lead.email!.trim().toLowerCase()}) and (${leads.meta} ? 'purchase' or ${leads.meta} ? 'emailUnsubscribedAt')`).limit(1);
  if (blocked) return false;
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) { failures.push(`${lead.id}: payment check not configured`); return false; }
  try {
    const res = await fetch(`${EMAIL.origin}/api/internal/payment-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ leadId: lead.id, email: lead.email }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data.ok || typeof data.paid !== "boolean") throw new Error("payment check failed");
    return !data.paid;
  } catch {
    failures.push(`${lead.id}: payment check failed; email postponed`);
    return false;
  }
}

/** Merge into the current row: concurrent payment/unsubscribe writes must survive. */
async function recordEmails(lead: typeof leads.$inferSelect, patch: Record<string, unknown>, now: Date) {
  const [updated] = await db.update(leads).set({
    meta: sql`jsonb_set(${leads.meta}, '{emails}', coalesce(${leads.meta}->'emails', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb)`,
    updated_at: now,
  }).where(eq(leads.id, lead.id)).returning();
  if (updated) await refreshLeadCard(updated);
}

function estimate(meta: Record<string, unknown>): string | null {
  const e = meta.estimateShown as { min?: number; max?: number } | undefined;
  if (e?.min == null || e?.max == null || e.max <= 0) return null;
  const f = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (e.min >= e.max) return f(e.max);
  // A range starting at $0 reads as made up (same rule as the site).
  if (e.min <= 0 || e.min < e.max * 0.15) return `up to ${f(e.max)}`;
  return `${f(e.min)}–${f(e.max)}`;
}

function productLines(meta: Record<string, unknown>): string[] {
  const facts = ((meta.docFacts as { products?: { key: string; providerSlug?: string | null; administrator?: { name?: string } | null }[] } | undefined)?.products) ?? [];
  const types = (Array.isArray(meta.productTypes) ? meta.productTypes : []) as string[];
  const keys = [...new Set([...types.filter((t) => t !== "not-sure"), ...facts.map((f) => f.key)])];
  return keys.map((k) => {
    const f = facts.find((x) => x.key === k);
    const picked = k === "gap" ? meta.gapProviderSlug : k === "vsc" ? meta.vscProviderSlug : null;
    const who = f?.providerSlug ? slugName(f.providerSlug) : f?.administrator?.name ?? (typeof picked === "string" && picked !== "not-sure" ? slugName(picked) : null);
    return `${PRODUCT[k] ?? k}${who ? ` → ${who}` : ""}`;
  });
}

/** Latest "full refund" date from the paperwork's purchase dates (60-day window), if still ahead. */
function fullRefundUntil(meta: Record<string, unknown>, now: Date): string | null {
  const facts = ((meta.docFacts as { products?: { purchaseDate?: string | null }[] } | undefined)?.products) ?? [];
  const ends = facts
    .map((p) => (p.purchaseDate ? Date.parse(p.purchaseDate) + 60 * 86400_000 : NaN))
    .filter((t) => Number.isFinite(t) && t > now.getTime());
  return ends.length ? formatDate(new Date(Math.max(...ends))) : null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}
