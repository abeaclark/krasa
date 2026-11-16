import { randomBytes } from "node:crypto";
import { isKnownSite } from "@/lib/enums";

/**
 * Pure logic for the email-capture popup backend (no database, no network), so
 * every rule here is unit-tested in tests/capture.test.ts.
 *
 * Spec: ~/projects/porfolio/specs/email-capture/SPEC.md §6–§9.
 */

export const CAPTURE_EVENTS = ["view", "close", "click"] as const;
export type CaptureEventT = (typeof CAPTURE_EVENTS)[number];
export const DEVICES = ["desktop", "mobile"] as const;
export type DeviceT = (typeof DEVICES)[number];
export type CounterT = "views" | "closes" | "clicks" | "signups";

export const EVENT_COUNTER: Record<CaptureEventT, CounterT> = {
  view: "views",
  close: "closes",
  click: "clicks",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function str(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function normEmail(v: unknown): string | null {
  const e = str(v, 320)?.toLowerCase() ?? null;
  return e && EMAIL_RE.test(e) ? e : null;
}

export function isDevice(v: unknown): v is DeviceT {
  return v === "desktop" || v === "mobile";
}

/** Calendar day (YYYY-MM-DD) in Pacific/Honolulu — the day the counters use. */
export function hstDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The HST day before `d`'s HST day. */
export function hstYesterday(d: Date = new Date()): string {
  return hstDay(new Date(d.getTime() - 86_400_000));
}

/**
 * Round robin: the listed offer shown the fewest times so far; ties go to the
 * earlier one in the list. Ids never seen before count as 0.
 */
export function pickOffer(offers: string[], counts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestN = Infinity;
  for (const id of offers) {
    const n = counts[id] ?? 0;
    if (n < bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

export function cleanOfferIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const id = str(x, 120);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= 12) break;
  }
  return out;
}

/** Unsubscribe + answer token: opaque, random, stored on the row. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function validTz(tz: string | null | undefined): string {
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {
      /* fall through */
    }
  }
  return "Pacific/Honolulu";
}

/**
 * The exact local moment a code stops working, as the email states it:
 * "Sat, Nov 14 at 9:32 AM HST".
 */
export function formatExpiry(
  expiresAt: string | Date,
  tz?: string | null,
): { day: string; time: string; abbr: string; dayTime: string; full: string } {
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const timeZone = validTz(tz);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const time = `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.trim();
  const abbr = get("timeZoneName");
  const dayTime = `${day} at ${time}`;
  return { day, time, abbr, dayTime, full: `${dayTime} ${abbr}`.trim() };
}

// ---- /api/subscribe payload ------------------------------------------------

export type RewardTypeT = "code" | "download" | "list";

export interface Reward {
  type: RewardTypeT;
  title: string;
  /** What the consent line and subject call it: "pack", "code", "puzzles". */
  thing: string | null;
  offerShort: string | null;
  offerLine: string | null;
  checkoutHref: string | null;
  pdf: string | null;
  code: { value: string; expiresAt: string } | null;
}

export interface SubscribeInput {
  site: string;
  email: string;
  offer: string;
  variant: string | null;
  page: string | null;
  device: DeviceT | null;
  tz: string | null;
  country: string | null;
  consent: { text: string; euCheckbox: boolean | null };
  /** False only when an opt-in box was shown and left unticked. */
  marketing: boolean;
  reward: Reward;
  utm: Record<string, string>;
}

export type ParseResult =
  | { ok: true; input: SubscribeInput }
  | { ok: false; error: string };

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function parseSubscribe(body: unknown, now: Date = new Date()): ParseResult {
  const b = obj(body);
  const site = str(b.site, 100);
  if (!site || !isKnownSite(site)) return { ok: false, error: "Unknown site" };
  const email = normEmail(b.email);
  if (!email) return { ok: false, error: "Invalid email address" };
  const offer = str(b.offer, 120);
  if (!offer) return { ok: false, error: "Missing offer" };

  const c = obj(b.consent);
  const consentText = str(c.text, 600);
  if (!consentText) return { ok: false, error: "Missing consent text" };
  const euCheckbox = typeof c.euCheckbox === "boolean" ? c.euCheckbox : null;

  const r = obj(b.reward);
  const type = r.type;
  if (type !== "code" && type !== "download" && type !== "list") {
    return { ok: false, error: "Invalid reward type" };
  }
  const title = str(r.title, 200);
  if (!title) return { ok: false, error: "Missing reward title" };

  let code: Reward["code"] = null;
  if (type === "code") {
    const rc = obj(r.code);
    const value = str(rc.value, 60);
    const expires = str(rc.expiresAt, 40);
    const t = expires ? Date.parse(expires) : NaN;
    if (!value || !/^[A-Z0-9-]+$/i.test(value) || Number.isNaN(t)) {
      return { ok: false, error: "Invalid code" };
    }
    // Codes live 24 hours (SPEC §6). Refuse anything already dead or oddly long.
    if (t <= now.getTime() || t > now.getTime() + 49 * 3_600_000) {
      return { ok: false, error: "Invalid code expiry" };
    }
    code = { value, expiresAt: new Date(t).toISOString() };
  }
  const pdf = str(r.pdf, 500);
  if (type === "download" && !pdf) return { ok: false, error: "Missing download link" };

  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(b.utm))) {
    const val = str(v, 200);
    if (val && /^[a-z_]{1,40}$/i.test(k) && Object.keys(utm).length < 10) utm[k] = val;
  }

  return {
    ok: true,
    input: {
      site,
      email,
      offer,
      variant: str(b.variant, 10),
      page: str(b.page, 500),
      device: isDevice(b.device) ? b.device : null,
      tz: str(b.tz, 60),
      country: str(b.country, 2)?.toUpperCase() ?? null,
      consent: { text: consentText, euCheckbox },
      marketing: euCheckbox !== false,
      reward: {
        type,
        title,
        thing: str(r.thing, 40),
        offerShort: str(r.offerShort, 120),
        offerLine: str(r.offerLine, 400),
        checkoutHref: str(r.checkoutHref, 500),
        pdf,
        code,
      },
      utm,
    },
  };
}
