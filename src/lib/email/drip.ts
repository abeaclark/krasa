/**
 * RefundAuto "didn't pay" drip.
 *
 * Who: people who saw a CONFIRMED cancellation kit (the paid offer) and
 * haven't paid. People whose kit was free get nothing from here (their kit
 * cost nothing to finish), and paying customers are never emailed by this
 * sequence — or by the refund check-ins (see outcome-emails).
 *
 * People who gave an email but left before seeing their plan get ONE
 * "your kit is ready" email and nothing more: we don't know yet whether
 * their kit would be charged for.
 *
 * Runs every 30 minutes (vercel.json). Pure so it can be tested.
 */

export type DripStep = "ready" | "shrinks" | "how" | "tip" | "offer";
/**
 * The live sequence. Cut from five emails to three on 2026-10-31: over Sep 29 –
 * Oct 29, 116 people got "ready" (14 clicked, 2 bought), and "shrinks", "how",
 * "tip" and "offer" drew 0–1 clicks and no sales each. "how" and "tip" stay in
 * the type (and templates) only because older leads have them in `sent`.
 */
export const DRIP_STEPS: DripStep[] = ["ready", "shrinks", "offer"];
/** Gap after the previous email, per step (the final offer waits longer). */
export const STEP_GAP_MS: Partial<Record<DripStep, number>> = { shrinks: 20 * 3600_000, offer: 44 * 3600_000 };

/**
 * Subject-line test. Each person gets one variant for the whole sequence
 * (a = discount-led, b = their own refund-led), stable by lead id, recorded
 * on every `sent` entry and in the link's utm_campaign (drip-ready-b, …) so
 * clicks and sales can be split by variant.
 */
export type SubjectVariant = "a" | "b";
export function subjectVariant(leadId: string): SubjectVariant {
  let h = 0;
  for (const c of leadId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? "a" : "b";
}

/** Minimum quiet time after their last action before the first email. */
export const FIRST_AFTER_MS = 30 * 60_000;
/** Later steps: at least this long after the previous email… */
export const GAP_MS = 20 * 3600_000;
/** …and only between these local hours. */
export const SEND_HOURS: [number, number] = [9, 20];
/** Early offer covers the sequence; the final offer has its own 72-hour window. */
export const EARLY_OFFER_HOURS = 7 * 24;
export const OFFER_HOURS = 72;
export const dripPercentOff = (step: DripStep): 20 | 50 => step === "offer" ? 50 : 20;
export interface DripOffer { code: string; expiresAt: string; percentOff?: number }

/** Reuse a live code across reminders; replace legacy offers and upgrade the last email. */
export function reusableDripOffer(offer: DripOffer | null | undefined, step: DripStep, now: Date): boolean {
  return !!offer && offer.percentOff === dripPercentOff(step) && Date.parse(offer.expiresAt) > now.getTime();
}
/** Don't start a drip for leads older than this (no surprise emails to old leads). */
export const MAX_START_AGE_MS = 3 * 86400_000;
/**
 * Nobody who came through before the paywall shipped gets the drip — many of
 * them already have their letters for free.
 */
export const DRIP_LAUNCH = Date.parse("2026-09-28T23:00:00Z");

type Meta = Record<string, unknown>;

export interface DripState {
  sent: { step: DripStep; at: string; variant?: SubjectVariant }[];
  offer?: DripOffer | null;
}

export function dripState(meta: Meta): DripState {
  const d = ((meta.emails as Meta | undefined)?.drip ?? {}) as Partial<DripState>;
  return { sent: Array.isArray(d.sent) ? d.sent : [], offer: d.offer ?? null };
}

/** Last time the PERSON did something (not us writing bookkeeping). */
export function lastActivity(meta: Meta, createdAt: Date): number {
  const stages = Array.isArray(meta._stages) ? (meta._stages as { at?: string }[]) : [];
  return Math.max(createdAt.getTime(), ...stages.map((s) => (s.at ? Date.parse(s.at) : 0)));
}

const STATE_TZ: Record<string, string> = {
  Hawaii: "Pacific/Honolulu", Alaska: "America/Anchorage",
  California: "America/Los_Angeles", Washington: "America/Los_Angeles", Oregon: "America/Los_Angeles", Nevada: "America/Los_Angeles",
  Arizona: "America/Phoenix", Utah: "America/Denver", Colorado: "America/Denver", "New Mexico": "America/Denver",
  Wyoming: "America/Denver", Montana: "America/Denver", Idaho: "America/Denver",
  Texas: "America/Chicago", Oklahoma: "America/Chicago", Kansas: "America/Chicago", Nebraska: "America/Chicago",
  "South Dakota": "America/Chicago", "North Dakota": "America/Chicago", Minnesota: "America/Chicago", Iowa: "America/Chicago",
  Missouri: "America/Chicago", Arkansas: "America/Chicago", Louisiana: "America/Chicago", Mississippi: "America/Chicago",
  Alabama: "America/Chicago", Tennessee: "America/Chicago", Wisconsin: "America/Chicago", Illinois: "America/Chicago",
};

export function localHour(state: unknown, at: Date): number {
  const tz = (typeof state === "string" && STATE_TZ[state]) || "America/New_York";
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(at));
}

export type DripDecision = { step: DripStep } | { skip: string };

/** What (if anything) to send this lead right now. */
export function dueDripStep(opts: {
  meta: Meta;
  createdAt: Date;
  hasEmail: boolean;
  now: Date;
}): DripDecision {
  const { meta, now } = opts;
  if (!opts.hasEmail) return { skip: "no email" };
  if (meta.purchase) return { skip: "paid" };
  if (meta.emailUnsubscribedAt) return { skip: "unsubscribed" };
  if (opts.createdAt.getTime() < DRIP_LAUNCH) return { skip: "before launch" };
  if ((meta.emails as Meta | undefined)?.letters) return { skip: "letters emailed" };
  if (meta.hasProducts === "no") return { skip: "no products" };

  const stages = new Set((Array.isArray(meta._stages) ? (meta._stages as { stage?: string }[]) : []).map((s) => s.stage));
  const plan = meta.plan as { complete?: boolean; paywall?: boolean } | undefined;
  const est = meta.estimateShown as { max?: number } | undefined;
  const firstSteps = ((meta.plan as { firstSteps?: string[] } | undefined)?.firstSteps ?? []).join(" ");
  const { sent } = dripState(meta);
  const last = lastActivity(meta, opts.createdAt);
  const t = now.getTime();

  // Free kit (unconfirmed contacts, small refund, or a GAP claim), or they
  // already downloaded one: nothing to sell.
  if (plan && (plan.paywall === false || !plan.complete)) return { skip: "free kit" };
  if (typeof est?.max === "number" && est.max < 300) return { skip: "small refund" };
  if (/:\s*claim\b/.test(firstSteps)) return { skip: "GAP claim" };
  if (stages.has("letters-downloaded") && !plan?.complete) return { skip: "downloaded" };

  if (sent.length === 0) {
    // Started checkout and left: the abandoned-checkout email goes instead of "ready".
    if (checkoutPending(meta, now)) return { skip: "checkout email pending" };
    if (t - opts.createdAt.getTime() > MAX_START_AGE_MS) return { skip: "too old to start" };
    if (t - last < FIRST_AFTER_MS) return { skip: "still active" };
    return { step: "ready" };
  }

  // Never saw a confirmed plan: the single "your kit is ready" is all they get.
  if (!plan?.complete) return { skip: "no confirmed plan" };

  // First live step not yet sent (people mid-sequence when it was cut skip
  // straight from wherever they are to the next live step).
  const done = new Set(sent.map((s) => s.step));
  const next = DRIP_STEPS.find((s) => !done.has(s));
  if (!next) return { skip: "done" };
  // The "easier than you think" and abandoned-checkout emails count as the previous email.
  const prevAt = Math.max(Date.parse(sent[sent.length - 1].at), dfySentAt(meta) ?? 0, checkoutSentAt(meta) ?? 0);
  if (t - prevAt < (STEP_GAP_MS[next] ?? GAP_MS)) return { skip: "waiting" };
  // They came back since our last email: give them the quiet period again.
  if (t - last < FIRST_AFTER_MS) return { skip: "still active" };
  const h = localHour(meta.state, now);
  if (h < SEND_HOURS[0] || h >= SEND_HOURS[1]) return { skip: "outside send hours" };
  return { step: next };
}

// ---------------------------------------------------------------------------
// "Get your paperwork" reminders.
//
// People who reached their plan without paperwork, where we couldn't place
// any product without it, get no kit — they get help getting their contract
// and a way back in to upload it (refundguy ActionPlan.paperwork). These
// three emails bring them back. Separate from the paid-offer drip above:
// those people have nothing to buy yet.
// ---------------------------------------------------------------------------

export type PaperStep = "paper1" | "paper2" | "paper3";
export const PAPER_STEPS: PaperStep[] = ["paper1", "paper2", "paper3"];
/** Quiet time before each: after their last action, then after the previous email. */
const PAPER_WAIT_MS = [18 * 3600_000, 2 * 86400_000, 4 * 86400_000];

export function paperState(meta: Meta): { sent: { step: PaperStep; at: string }[] } {
  const p = ((meta.emails as Meta | undefined)?.paperwork ?? {}) as { sent?: { step: PaperStep; at: string }[] };
  return { sent: Array.isArray(p.sent) ? p.sent : [] };
}

const GENERATED_DOC = /(cancellation-let|records-request|claim-notice)[^/]*\.pdf$/i;

/** They've uploaded their own paperwork (our letter PDFs don't count). */
export function hasOwnPaperwork(meta: Meta): boolean {
  if (meta.docFacts) return true;
  const docs = Array.isArray(meta.documents) ? (meta.documents as { name?: string; path?: string }[]) : [];
  return docs.some((d) => !GENERATED_DOC.test(d.name ?? "") && !GENERATED_DOC.test(d.path ?? ""));
}

export type PaperDecision = { step: PaperStep } | { skip: string };

export function duePaperworkStep(opts: { meta: Meta; createdAt: Date; hasEmail: boolean; now: Date }): PaperDecision {
  const { meta, now } = opts;
  if (!opts.hasEmail) return { skip: "no email" };
  if (meta.purchase) return { skip: "paid" };
  if (meta.emailUnsubscribedAt) return { skip: "unsubscribed" };
  const plan = meta.plan as { letters?: number; paperworkWaiting?: string[] } | undefined;
  // Only plans built since the paperwork step shipped carry paperworkWaiting.
  if (!plan?.paperworkWaiting?.length) return { skip: "not waiting on paperwork" };
  if ((plan.letters ?? 0) > 0) return { skip: "has a kit" };
  if (hasOwnPaperwork(meta)) return { skip: "uploaded" };

  const { sent } = paperState(meta);
  const t = now.getTime();
  const next = PAPER_STEPS[sent.length];
  if (!next) return { skip: "done" };
  if (sent.length === 0) {
    // Started checkout and left: the abandoned-checkout email goes instead of "ready".
    if (checkoutPending(meta, now)) return { skip: "checkout email pending" };
    if (t - opts.createdAt.getTime() > MAX_START_AGE_MS) return { skip: "too old to start" };
    if (t - lastActivity(meta, opts.createdAt) < PAPER_WAIT_MS[0]) return { skip: "waiting" };
  } else {
    if (t - Date.parse(sent[sent.length - 1].at) < PAPER_WAIT_MS[sent.length]) return { skip: "waiting" };
    if (t - lastActivity(meta, opts.createdAt) < FIRST_AFTER_MS) return { skip: "still active" };
  }
  const h = localHour(meta.state, now);
  if (h < SEND_HOURS[0] || h >= SEND_HOURS[1]) return { skip: "outside send hours" };
  return { step: next };
}

// ---------------------------------------------------------------------------
// "It may be easier than you think" — one email to people who picked
// Done for you.
//
// We'd rather not do the work by hand, so the follow-up to a done-for-you
// click is the cancellation kit: what each of their products takes (usually
// one call or one form) and the kit at a fraction of the price. Anyone who
// still wants us to handle it can reply — the offer stays real.
//
// Sent once, after a short quiet period, in their daytime. Counts as the
// drip's "ready" email, so they never get both back to back.
// ---------------------------------------------------------------------------

export const DFY_STAGES = ["done-for-you-clicked", "done-for-you-requested"];
/** Don't follow up on a done-for-you click older than this. */
export const DFY_MAX_AGE_MS = 7 * 86400_000;
/** Quiet time after their last action — they may still be buying on the page. */
export const DFY_AFTER_MS = 20 * 60_000;

export function dfySentAt(meta: Meta): number | null {
  const at = ((meta.emails as Meta | undefined)?.dfy as { at?: string } | undefined)?.at;
  return at ? Date.parse(at) : null;
}

export type DfyDecision = { send: true } | { skip: string };

export function dueDfyEmail(opts: { meta: Meta; createdAt: Date; hasEmail: boolean; now: Date }): DfyDecision {
  const { meta, now } = opts;
  const stages = Array.isArray(meta._stages) ? (meta._stages as { stage?: string; at?: string }[]) : [];
  const clicked = stages.filter((s) => s.stage && DFY_STAGES.includes(s.stage)).map((s) => (s.at ? Date.parse(s.at) : 0));
  if (!clicked.length) return { skip: "no done-for-you click" };
  if (!opts.hasEmail) return { skip: "no email" };
  if (meta.purchase) return { skip: "paid" };
  if (meta.emailUnsubscribedAt) return { skip: "unsubscribed" };
  if (dfySentAt(meta) != null) return { skip: "dfy sent" };
  const t = now.getTime();
  if (t - Math.max(...clicked) > DFY_MAX_AGE_MS) return { skip: "dfy too old" };
  if (t - lastActivity(meta, opts.createdAt) < DFY_AFTER_MS) return { skip: "still active" };
  const h = localHour(meta.state, now);
  if (h < SEND_HOURS[0] || h >= SEND_HOURS[1]) return { skip: "outside send hours" };
  return { send: true };
}

// ---------------------------------------------------------------------------
// Abandoned checkout — one email to people who clicked buy (or reached
// Stripe) and didn't pay.
//
// Sent once per person, ever, after a 45-minute quiet period, in their
// daytime, within 48 hours of the click. No discount: they were already
// willing at full price, and a discount here teaches people to abandon.
// It stands in for the drip's "ready" email when the drip hasn't started, and
// counts as the previous email otherwise, so nobody gets two back to back;
// it also waits if any of our emails went out in the last 4 hours.
// The cron re-checks Stripe (canSendMarketing) before sending, so a buyer who
// closed the Stripe tab before we recorded the sale is never emailed.
// ---------------------------------------------------------------------------

export const CHECKOUT_STAGES = ["buy-clicked", "checkout-started"];
export const CHECKOUT_AFTER_MS = 45 * 60_000;
export const CHECKOUT_MAX_AGE_MS = 48 * 3600_000;
/** Don't follow another of our emails this closely. */
export const CHECKOUT_MIN_GAP_MS = 4 * 3600_000;

export function checkoutSentAt(meta: Meta): number | null {
  const at = ((meta.emails as Meta | undefined)?.checkout as { at?: string } | undefined)?.at;
  return at ? Date.parse(at) : null;
}

function lastCheckoutClick(meta: Meta): number | null {
  const stages = Array.isArray(meta._stages) ? (meta._stages as { stage?: string; at?: string }[]) : [];
  const ts = stages.filter((s) => s.stage && CHECKOUT_STAGES.includes(s.stage) && s.at).map((s) => Date.parse(s.at!));
  return ts.length ? Math.max(...ts) : null;
}

/** An abandoned-checkout email is still owed (or will be, once they've been quiet long enough). */
export function checkoutPending(meta: Meta, now: Date): boolean {
  const clicked = lastCheckoutClick(meta);
  return clicked != null && !meta.purchase && !meta.emailUnsubscribedAt && checkoutSentAt(meta) == null && now.getTime() - clicked <= CHECKOUT_MAX_AGE_MS;
}

export type CheckoutDecision = { send: true } | { skip: string };

export function dueCheckoutEmail(opts: { meta: Meta; createdAt: Date; hasEmail: boolean; now: Date }): CheckoutDecision {
  const { meta, now } = opts;
  const clicked = lastCheckoutClick(meta);
  if (clicked == null) return { skip: "no checkout" };
  if (!opts.hasEmail) return { skip: "no email" };
  if (meta.purchase) return { skip: "paid" };
  if (meta.emailUnsubscribedAt) return { skip: "unsubscribed" };
  if (checkoutSentAt(meta) != null) return { skip: "checkout sent" };
  const t = now.getTime();
  if (t - clicked > CHECKOUT_MAX_AGE_MS) return { skip: "checkout too old" };
  if (t - lastActivity(meta, opts.createdAt) < CHECKOUT_AFTER_MS) return { skip: "still active" };
  const sent = dripState(meta).sent;
  const lastEmail = Math.max(sent.length ? Date.parse(sent[sent.length - 1].at) : 0, dfySentAt(meta) ?? 0);
  if (t - lastEmail < CHECKOUT_MIN_GAP_MS) return { skip: "recent email" };
  const h = localHour(meta.state, now);
  if (h < SEND_HOURS[0] || h >= SEND_HOURS[1]) return { skip: "outside send hours" };
  return { send: true };
}
