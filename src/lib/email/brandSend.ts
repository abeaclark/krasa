import type { Brand } from "./brands";
import type { SendResult } from "./client";
import { dropBrokenImages } from "./images";
import { channelForSite, postSlackText } from "@/lib/slack";

const alerted = new Map<string, number>();

/** Slack once an hour per broken URL; never throws. */
async function alertBroken(site: string, subject: string, broken: string[]) {
  const now = Date.now();
  const fresh = broken.filter((u) => now - (alerted.get(u) ?? 0) > 3_600_000);
  if (!fresh.length) return;
  fresh.forEach((u) => alerted.set(u, now));
  console.error("[capture] broken email images removed", site, subject, fresh);
  await postSlackText(
    channelForSite(site),
    `:warning: ${site} email "${subject}" had broken images; they were removed before sending. Fix the URL(s):\n${fresh.map((u) => `• ${u}`).join("\n")}`,
  ).catch(() => {});
}

/**
 * Brands can live in different Resend accounts (a domain is verified in exactly
 * one). Each brand uses `RESEND_API_KEY_<NAME>` when it is set — NAME is the
 * domain's first label, upper-cased: RESEND_API_KEY_SOLVEDPARTY,
 * RESEND_API_KEY_SUNDAY101, RESEND_API_KEY_SUNLIGHTKIDS — and falls back to
 * RESEND_API_KEY otherwise. Two brands in the same second account just get the
 * same key value.
 */
export function resendKeyEnvName(site: string): string {
  return `RESEND_API_KEY_${site.split(".")[0].toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function resendKeyFor(
  site: string,
  env: Record<string, string | undefined> = process.env,
): { key: string | null; envName: string } {
  const own = resendKeyEnvName(site);
  const ownKey = env[own]?.trim();
  if (ownKey) return { key: ownKey, envName: own };
  return { key: env.RESEND_API_KEY?.trim() || null, envName: `${own} / RESEND_API_KEY` };
}

/**
 * Resend over fetch, for brand mail (popup rewards). Same approach as
 * client.ts, but the sender, reply-to and one-click unsubscribe target come
 * from the brand instead of the single RefundAuto identity. Never throws.
 */
export async function sendBrandEmail(opts: {
  brand: Brand;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adds the RFC 8058 one-click header (Gmail/Yahoo require it on bulk mail). */
  unsubscribeUrl: string;
}): Promise<SendResult> {
  const { key, envName } = resendKeyFor(opts.brand.site);
  if (!key) {
    console.warn(`[capture] ${envName} not set — skipping send`);
    return { ok: false, skipped: true, error: "Email is not configured" };
  }
  // Never send a broken image (see images.ts).
  let html = opts.html;
  try {
    const checked = await dropBrokenImages(opts.html);
    html = checked.html;
    if (checked.broken.length) await alertBroken(opts.brand.site, opts.subject, checked.broken);
  } catch (err) {
    console.error("[capture] image check threw", err);
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opts.brand.from,
        reply_to: opts.brand.replyTo,
        to: [opts.to],
        subject: opts.subject,
        html,
        text: opts.text,
        headers: {
          "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("[capture] send failed", res.status, body?.message);
      return { ok: false, error: body?.message || `Resend returned ${res.status}` };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    console.error("[capture] send threw", err);
    return { ok: false, error: "Network error talking to Resend" };
  }
}
