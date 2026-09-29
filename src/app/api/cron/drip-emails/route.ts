import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { sendEmail } from "@/lib/email/client";
import { dripEmail } from "@/lib/email/templates";
import { dueDripStep, dripState, OFFER_HOURS, type DripStep } from "@/lib/email/drip";
import { EMAIL } from "@/lib/email/config";
import { createToken, tokensConfigured } from "@/lib/email/tokens";
import { refreshLeadCard } from "@/lib/slack";
import { PRODUCT, slugName } from "@/lib/slackLeadCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 50;
const KIT_PRICE = 49;

/**
 * Every 30 minutes: the "didn't pay" drip for RefundAuto (lib/email/drip.ts).
 *
 *   GET /api/cron/drip-emails   (Vercel cron, Bearer CRON_SECRET)
 *
 * Off unless DRIP_ENABLED=1, so it can't start selling before payments are live.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.DRIP_ENABLED !== "1") return NextResponse.json({ ok: true, disabled: true });
  if (!tokensConfigured()) {
    return NextResponse.json({ ok: false, error: "EMAIL_TOKEN_SECRET is not set" }, { status: 503 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 14 * 86400_000);
  const rows = (await db.select().from(leads).where(eq(leads.site, "refundauto.com"))).filter((l) => l.created_at >= since);

  let sent = 0;
  const skipped: Record<string, number> = {};
  const failures: string[] = [];

  for (const lead of rows) {
    if (sent >= BATCH_LIMIT) break;
    const meta = (lead.meta ?? {}) as Record<string, unknown>;
    const decision = dueDripStep({ meta, createdAt: new Date(lead.created_at), hasEmail: !!lead.email, now });
    if ("skip" in decision) {
      skipped[decision.skip] = (skipped[decision.skip] ?? 0) + 1;
      continue;
    }
    const step: DripStep = decision.step;

    const kitToken = createToken(lead.id, "restore", 7);
    const unsubToken = createToken(lead.id, "unsubscribe");
    if (!kitToken || !unsubToken) continue;
    const kitUrl = `${EMAIL.origin}/restore?t=${encodeURIComponent(kitToken)}&utm_source=email&utm_campaign=drip-${step}`;

    let offer: { code: string; expiresAt: string } | null = null;
    if (step === "offer") {
      offer = await mintOffer(lead.id, lead.email!);
      if (!offer) {
        failures.push(`${lead.id}: offer code`);
        continue; // try again next run
      }
    }

    const msg = dripEmail(step, {
      firstName: (lead.name || "").trim().split(/\s+/)[0] || null,
      estimate: estimate(meta),
      products: productLines(meta),
      firstSteps: ((meta.plan as { firstSteps?: string[] } | undefined)?.firstSteps ?? []).slice(0, 6),
      fullRefundUntil: fullRefundUntil(meta, now),
      kitUrl,
      unsubscribeUrl: `${EMAIL.origin}/api/unsubscribe/${unsubToken}`,
      offer: offer
        ? {
            code: offer.code,
            expires: formatDate(new Date(offer.expiresAt)),
            url: `${kitUrl}&offer=${encodeURIComponent(offer.code)}`,
            price: `$${(KIT_PRICE * 0.7).toFixed(2)}`,
            fullPrice: `$${KIT_PRICE}`,
          }
        : null,
    });

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
        drip: { sent: [...drip.sent, { step, at: now.toISOString() }], offer: offer ?? drip.offer ?? null },
      },
    };
    await db.update(leads).set({ meta: nextMeta, updated_at: now }).where(eq(leads.id, lead.id));
    await refreshLeadCard({ ...lead, meta: nextMeta });
    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failures });
}

/** Ask refundauto.com (which holds the Stripe key) for a single-use 30% code. */
async function mintOffer(leadId: string, email: string): Promise<{ code: string; expiresAt: string } | null> {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) return null;
  try {
    const res = await fetch(process.env.KIT_PROMO_ENDPOINT || `${EMAIL.origin}/api/internal/promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ leadId, email, percentOff: 30, hours: OFFER_HOURS }),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string; expiresAt?: string };
    return data.ok && data.code && data.expiresAt ? { code: data.code, expiresAt: data.expiresAt } : null;
  } catch (err) {
    console.error("[drip] promo mint failed", err);
    return null;
  }
}

function estimate(meta: Record<string, unknown>): string | null {
  const e = meta.estimateShown as { min?: number; max?: number } | undefined;
  if (e?.min == null || e?.max == null || e.max <= 0) return null;
  const f = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
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
