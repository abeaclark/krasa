import { EMAIL, emailConfigured } from "./config";
import { createToken } from "./tokens";

/**
 * Thin Resend wrapper.
 *
 * Deliberately uses the REST API over `fetch` rather than the `resend` SDK —
 * we need exactly one operation, and this repo already takes the same approach
 * with Supabase Storage (see lib/storage.ts) for the same reason.
 *
 * Every send is best-effort and never throws: an email that fails must not
 * take down the request that triggered it. Failures are logged and returned so
 * the caller can record them.
 */

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Lead id, used to mint the one-click unsubscribe header. */
  leadId?: string;
  /** Transactional mail (the letters someone just asked for) doesn't get an
   *  unsubscribe header; the follow-up sequence does. */
  unsubscribable?: boolean;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", opts.to);
    return { ok: false, skipped: true, error: "Email is not configured" };
  }

  const headers: Record<string, string> = {};
  if (opts.unsubscribable && opts.leadId) {
    const token = createToken(opts.leadId, "unsubscribe");
    if (token) {
      // RFC 8058 one-click. Gmail and Yahoo both require this on bulk mail, and
      // an unsubscribe that works in one click is also the cheapest way to stop
      // someone reporting us as spam instead.
      headers["List-Unsubscribe"] = `<${EMAIL.origin}/api/unsubscribe/${token}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL.from,
        reply_to: EMAIL.replyTo,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("[email] send failed", res.status, body?.message);
      return { ok: false, error: body?.message || `Resend returned ${res.status}` };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    console.error("[email] send threw", err);
    return { ok: false, error: "Network error talking to Resend" };
  }
}
