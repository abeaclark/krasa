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
export const DRIP_STEPS: DripStep[] = ["ready", "shrinks", "how", "tip", "offer"];

/** Minimum quiet time after their last action before the first email. */
export const FIRST_AFTER_MS = 30 * 60_000;
/** Later steps: at least this long after the previous email… */
export const GAP_MS = 20 * 3600_000;
/** …and only between these local hours. */
export const SEND_HOURS: [number, number] = [9, 20];
/** How long the 30% code works. */
export const OFFER_HOURS = 72;
/** Don't start a drip for leads older than this (no surprise emails to old leads). */
export const MAX_START_AGE_MS = 3 * 86400_000;
/**
 * Nobody who came through before the paywall shipped gets the drip — many of
 * them already have their letters for free.
 */
export const DRIP_LAUNCH = Date.parse("2026-09-28T23:00:00Z");

type Meta = Record<string, unknown>;

export interface DripState {
  sent: { step: DripStep; at: string }[];
  offer?: { code: string; expiresAt: string } | null;
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
    if (t - opts.createdAt.getTime() > MAX_START_AGE_MS) return { skip: "too old to start" };
    if (t - last < FIRST_AFTER_MS) return { skip: "still active" };
    return { step: "ready" };
  }

  // Never saw a confirmed plan: the single "your kit is ready" is all they get.
  if (!plan?.complete) return { skip: "no confirmed plan" };

  const next = DRIP_STEPS[sent.length];
  if (!next) return { skip: "done" };
  const prevAt = Date.parse(sent[sent.length - 1].at);
  if (t - prevAt < GAP_MS) return { skip: "waiting" };
  // They came back since our last email: give them the quiet period again.
  if (t - last < FIRST_AFTER_MS) return { skip: "still active" };
  const h = localHour(meta.state, now);
  if (h < SEND_HOURS[0] || h >= SEND_HOURS[1]) return { skip: "outside send hours" };
  return { step: next };
}
