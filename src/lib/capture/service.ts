import { brandFor, brandUrl, unsubscribeUrl, type Brand } from "@/lib/email/brands";
import { buildRewardEmail } from "@/lib/email/reward";
import type { SendResult } from "@/lib/email/client";
import {
  CAPTURE_EVENTS,
  EVENT_COUNTER,
  cleanOfferIds,
  hstDay,
  isDevice,
  parseSubscribe,
  str,
  type CaptureEventT,
} from "./core";
import type { CaptureStore } from "./store";
import { isKnownSite } from "@/lib/enums";

/**
 * The capture routes' behavior, with storage and email injected so it runs in
 * tests against the in-memory store. Returns { status, body } for the route
 * to serialize.
 */

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export type SendFn = (opts: {
  brand: Brand;
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}) => Promise<SendResult>;

const bad = (error: string, status = 400): Reply => ({ status, body: { ok: false, error } });

function o(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function assign(store: CaptureStore, body: unknown): Promise<Reply> {
  const b = o(body);
  const site = str(b.site, 100);
  if (!site || !isKnownSite(site)) return bad("Unknown site");
  const offers = cleanOfferIds(b.offers);
  if (!offers.length) return bad("No offers");
  const offer = await store.assign(site, offers);
  return { status: 200, body: { ok: true, offer } };
}

export async function event(store: CaptureStore, body: unknown, now = new Date()): Promise<Reply> {
  const b = o(body);
  const site = str(b.site, 100);
  if (!site || !isKnownSite(site)) return bad("Unknown site");
  const offer = str(b.offer, 120);
  const ev = b.event as CaptureEventT;
  if (!offer || !CAPTURE_EVENTS.includes(ev) || !isDevice(b.device)) return bad("Invalid event");
  await store.bump(site, offer, b.device, hstDay(now), EVENT_COUNTER[ev]);
  return { status: 200, body: { ok: true } };
}

export async function subscribe(
  store: CaptureStore,
  body: unknown,
  send: SendFn,
  now = new Date(),
): Promise<Reply> {
  // Honeypot: tell the bot it worked, store nothing, send nothing.
  const hp = o(body).hp ?? o(body).company;
  if (typeof hp === "string" && hp.trim()) return { status: 200, body: { ok: true, token: null } };

  const parsed = parseSubscribe(body, now);
  if (!parsed.ok) return bad(parsed.error);
  const input = parsed.input;
  const brand = brandFor(input.site);
  if (!brand) return bad("This site has no email brand configured");

  // Links in the email must live on the brand's own domain.
  const pdf = input.reward.pdf ? brandUrl(brand, input.reward.pdf) : null;
  const checkout = input.reward.checkoutHref ? brandUrl(brand, input.reward.checkoutHref) : null;
  if (input.reward.type === "download" && !pdf) return bad("Download link must be on the brand's domain");
  if (input.reward.checkoutHref && !checkout) return bad("Checkout link must be on the brand's domain");

  const { row, created } = await store.upsertSubscriber(input, now);
  if (created) {
    await store.bump(input.site, input.offer, input.device ?? "desktop", hstDay(now), "signups");
  }

  // Never mail an address that bounced or reported us.
  if (row.status === "bounced" || row.status === "complained") {
    return { status: 200, body: { ok: true, token: row.token, emailed: false } };
  }

  const mail = buildRewardEmail({
    brand,
    reward: input.reward,
    links: { pdf, checkout },
    token: row.token,
    tz: input.tz,
    marketing: row.marketing,
  });
  // Sent before returning so a failure surfaces to the caller.
  const sent = await send({
    brand,
    to: row.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    unsubscribeUrl: unsubscribeUrl(brand, row.token),
  });
  if (!sent.ok && !sent.skipped) {
    return { status: 502, body: { ok: false, error: "Could not send the email", token: row.token } };
  }
  return { status: 200, body: { ok: true, token: row.token, emailed: sent.ok } };
}

export async function answer(store: CaptureStore, body: unknown): Promise<Reply> {
  const b = o(body);
  const token = str(b.token, 100);
  const question = str(b.question, 120);
  const ans = str(b.answer, 120);
  if (!token || !question || !ans) return bad("Missing token, question or answer");
  const ok = await store.mergeAnswer(token, question, ans);
  return ok ? { status: 200, body: { ok: true } } : bad("Unknown token", 404);
}

/** GET and POST both unsubscribe, immediately and idempotently. */
export async function unsubscribe(store: CaptureStore, token: string, now = new Date()): Promise<Reply> {
  const t = str(token, 100);
  const row = t ? await store.unsubscribe(t, now) : null;
  if (!row) return bad("That link is not valid", 404);
  const brand = brandFor(row.site);
  return { status: 200, body: { ok: true, site: row.site, brand: brand?.name ?? row.site } };
}
