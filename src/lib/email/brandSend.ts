import type { Brand } from "./brands";
import type { SendResult } from "./client";

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
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[capture] RESEND_API_KEY not set — skipping send");
    return { ok: false, skipped: true, error: "Email is not configured" };
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
        html: opts.html,
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
