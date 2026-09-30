import type { Lead } from "@/db/schema";

/**
 * RefundAuto's lead card: ONE Slack message per lead that is edited in place
 * as the person moves through the funnel, with the thing that matters most —
 * did they pay — in the headline. Details are condensed into a two-column
 * grid; the full record is still in the database.
 */

type Meta = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? `$${Math.round(n).toLocaleString("en-US")}` : null);

const VEHICLE: Record<string, string> = {
  "still-have-it": "Still has car", "traded-in": "Traded in", refinanced: "Refinanced",
  "paid-off-early": "Paid off early", sold: "Sold", totaled: "Totaled",
};
const LOAN: Record<string, string> = {
  "paid-off": "loan paid off", "refinanced-loan": "loan refinanced", "yes-active": "loan active", "not-sure": "loan ?",
};
export const PRODUCT: Record<string, string> = {
  gap: "GAP", vsc: "VSC", maintenance: "Maintenance", "tire-wheel": "Tire & wheel", "key-replacement": "Key",
  "dent-protection": "Dent", windshield: "Windshield", "theft-vin": "Theft/VIN", "paint-appearance": "Paint", "not-sure": "Not sure",
};

/** "cancel-gs-administrators-refund" → "GS Administrators"-ish. */
export function slugName(slug: string): string {
  if (slug === "dealer-in-house") return "dealer (in-house)";
  if (slug === "lender-direct") return "lender";
  if (slug === "not-sure") return "?";
  return slug.replace(/^cancel-/, "").replace(/-refund$/, "").split("-")
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
}

function stages(meta: Meta): Set<string> {
  const s = Array.isArray(meta._stages) ? (meta._stages as { stage?: string }[]) : [];
  return new Set(s.map((x) => x.stage || ""));
}

export function refundAutoStatus(lead: Lead): { emoji: string; text: string } {
  const m = (lead.meta ?? {}) as Meta;
  const st = stages(m);
  const outcome = (m.outcome as { answer?: string } | undefined)?.answer;
  const purchase = m.purchase as { amount?: number } | undefined;
  const plan = m.plan as { complete?: boolean; paywall?: boolean; freeReason?: string | null } | undefined;
  if (outcome === "received") return { emoji: "🎉", text: "Refund received" };
  if (outcome === "denied") return { emoji: "❌", text: "Refund denied" };
  if (purchase) return { emoji: "💰", text: `Paid ${money((purchase.amount ?? 4900) / 100) ?? "$49"}` };
  if (st.has("checkout-started")) return { emoji: "🛒", text: "At checkout — not paid" };
  if (st.has("buy-clicked")) return { emoji: "🖱️", text: "Clicked buy — checkout didn't open" };
  if (st.has("letters-downloaded")) return { emoji: "⬇️", text: plan?.complete === false ? "Downloaded free kit" : "Downloaded kit" };
  if (plan) {
    if (plan.paywall ?? plan.complete) return { emoji: "🔒", text: "Saw paid offer — not paid" };
    const why = plan.freeReason === "small" ? "small refund" : plan.freeReason === "claim" ? "GAP claim" : "contacts unconfirmed";
    return { emoji: "🆓", text: `Free kit (${why})` };
  }
  if (st.has("paperwork-details")) return { emoji: "📝", text: "Filled in details" };
  return { emoji: "👀", text: "Contact captured" };
}

function products(m: Meta): string | null {
  const types = (Array.isArray(m.productTypes) ? m.productTypes : []) as string[];
  const facts = ((m.docFacts as { products?: { key: string; providerSlug?: string | null; administrator?: { name?: string } | null }[] } | undefined)?.products) ?? [];
  const anc = (m.ancillaryProviderSlugs ?? {}) as Record<string, string>;
  const keys = [...new Set([...types, ...facts.map((f) => f.key)])];
  if (!keys.length) return null;
  return keys.map((k) => {
    const fact = facts.find((f) => f.key === k);
    const picked = k === "gap" ? str(m.gapProviderSlug) : k === "vsc" ? str(m.vscProviderSlug) : anc[k] ?? null;
    const who = fact?.providerSlug ? slugName(fact.providerSlug) : fact?.administrator?.name ?? (picked ? slugName(picked) : null);
    return `${PRODUCT[k] ?? k}${who ? ` → ${who}` : ""}${fact ? " 📄" : ""}`;
  }).join("\n");
}

function paperwork(m: Meta): string | null {
  const docs = Array.isArray(m.documents) ? m.documents.length : 0;
  const a = m.documentAnalysis as { status?: string; ready?: boolean; openRequests?: unknown[]; skipped?: boolean } | undefined;
  if (!docs && !a) return m.hasDocuments ? `none (${m.hasDocuments})` : null;
  const ai = !a ? "" : a.status === "done"
    ? a.ready ? " · AI ✓ complete" : ` · AI needs ${a.openRequests?.length ?? 1} page(s)${a.skipped ? ", skipped" : ""}`
    : ` · AI ${a.status}`;
  return `${docs} file${docs === 1 ? "" : "s"}${ai}`;
}

function progress(lead: Lead): string {
  const m = (lead.meta ?? {}) as Meta;
  const st = stages(m);
  const steps: [string, boolean][] = [
    ["Contact", true],
    ["Details", st.has("paperwork-details")],
    ["Plan", !!m.plan || st.has("letters-downloaded")],
    ["Clicked buy", st.has("buy-clicked") || st.has("checkout-started") || !!m.purchase],
    ["Checkout", st.has("checkout-started") || !!m.purchase],
    ["Paid", !!m.purchase],
    ["Downloaded", st.has("letters-downloaded")],
  ];
  return steps.map(([l, ok]) => `${ok ? "✅" : "▫️"} ${l}`).join("  ");
}

function dripLine(m: Meta): string | null {
  const d = ((m.emails as Meta | undefined)?.drip ?? null) as { sent?: { step: string }[]; offer?: { code?: string } } | null;
  const click = (m.lastEmailClick as { campaign?: string } | undefined)?.campaign;
  if (!d?.sent?.length && !click) return null;
  return [d?.sent?.length ? `Drip ${d.sent.length}/5 sent${d.offer?.code ? ` · code ${d.offer.code}` : ""}` : null, click ? `Came back via ${click}` : null]
    .filter(Boolean)
    .join("\n");
}

export function buildRefundAutoCard(lead: Lead, dashboardLink?: string | null): { text: string; blocks: unknown[] } {
  const m = (lead.meta ?? {}) as Meta;
  const { emoji, text } = refundAutoStatus(lead);
  const who = lead.name || lead.email || `lead ${lead.id.slice(0, 8)}`;
  const est = m.estimateShown as { min?: number; max?: number } | undefined;
  const plan = m.plan as { complete?: boolean; letters?: number; unverified?: number } | undefined;
  const dealer = (m.docFacts as { dealer?: { name?: string } | null } | undefined)?.dealer?.name ?? (m.dealer as { name?: string } | undefined)?.name;
  const outcome = (m.outcome as { answer?: string } | undefined)?.answer;

  const fields: [string, string | null][] = [
    ["Est. refund", est?.min != null && est?.max != null ? `${money(est.min)}–${money(est.max)}` : null],
    ["Situation", [VEHICLE[str(m.vehicleStatus) ?? ""], LOAN[str(m.loanStatus) ?? ""], str(m.state)].filter(Boolean).join(" · ") || null],
    ["Products", products(m)],
    ["Paperwork", [paperwork(m), dashboardLink].filter(Boolean).join("\n") || null],
    ["Kit", plan ? (plan.complete ? `Confirmed (${plan.letters ?? "?"} products)` : `Free — ${plan.unverified ?? "?"} unconfirmed`) : null],
    ["Contact", [lead.email, lead.phone].filter(Boolean).join("\n") || null],
    ["Dealer", dealer ?? null],
    ["Lender", str(m.lender)],
    ["Refund outcome", outcome ?? null],
    ["Emails", dripLine(m)],
  ];
  const cells = fields.filter(([, v]) => v).slice(0, 10).map(([k, v]) => ({ type: "mrkdwn", text: `*${k}*\n${v}` }));

  return {
    text: `${emoji} ${text} — ${who}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${emoji} ${text}* — ${who}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: progress(lead) }] },
      ...(cells.length ? [{ type: "section", fields: cells }] : []),
      ...(m.doneForYouRequested || stages(m).has("done-for-you-requested")
        ? [{ type: "section", text: { type: "mrkdwn", text: "🙋 *Asked about Done for you* — follow up by email" } }]
        : []),
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `\`${lead.id}\` · ${lead.site} · received ${new Date(lead.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC · updated ${new Date().toISOString().slice(11, 16)} UTC` }],
      },
    ],
  };
}

/** Stages worth a reply in the thread (and a ping). Everything else just edits the card. */
export const LOUD_STAGES: Record<string, { text: string; broadcast?: boolean }> = {
  "kit-purchased": { text: "💰 Paid for the cancellation kit", broadcast: true },
  "done-for-you-requested": { text: "🙋 Asked about Done for you", broadcast: true },
  "checkout-started": { text: "🛒 Opened checkout" },
  "letters-downloaded": { text: "⬇️ Downloaded their kit" },
};
