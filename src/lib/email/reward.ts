import type { Brand } from "./brands";
import { unsubscribeUrl } from "./brands";
import { formatExpiry, type Reward } from "@/lib/capture/core";

/**
 * Reward emails for popup signups: one template per reward type (code,
 * download, list). Same table-based, inline-styled shell as layout.ts, but
 * themed per brand. Every message carries a plain-text part, the postal
 * address and a visible unsubscribe link; the one-click header is added by
 * sendBrandEmail.
 *
 * Nothing here mentions the price after an intro period or cancelling —
 * checkout shows those (SPEC §6).
 */

const INK = "#16171d";
const BODY = "#3f4250";
const MUTED = "#6b6e7b";
const LINE = "#e6e6e1";
const PAPER = "#f6f6f3";
const RED_DARK = "#a3062f";
const FONT = "Helvetica,Arial,sans-serif";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const p = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${BODY};">${html}</p>`;

const h1 = (text: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.25;color:${INK};">${esc(text)}</h1>`;

function button(b: Brand, label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">
  <tr><td align="center" bgcolor="${b.primary}" style="border-radius:8px;">
    <a href="${esc(href)}" style="display:inline-block;padding:15px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

function shell(b: Brand, opts: { preheader: string; bodyHtml: string; unsub: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(b.name)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:10px;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:.02em;color:${b.primary};">${esc(b.logoText)}</p>
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:8px 28px 28px;">
        <hr style="border:0;border-top:1px solid ${LINE};margin:16px 0;">
        <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
          ${esc(b.legalName)} &middot; ${esc(b.postalAddress)}<br>
          <a href="${esc(b.privacyUrl)}" style="color:${MUTED};">Privacy</a>
        </p>
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};"><a href="${esc(opts.unsub)}" style="color:${MUTED};">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function textFooter(b: Brand, unsub: string): string {
  return ["", "—", `${b.legalName} · ${b.postalAddress}`, `Privacy: ${b.privacyUrl}`, `Unsubscribe: ${unsub}`].join("\n");
}

const MARKETING_LINE =
  "From time to time we'll also send tips and offers. Unsubscribe with one click below.";

export interface RewardEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface RewardEmailInput {
  brand: Brand;
  reward: Reward;
  /** Absolute, brand-domain links (already validated by brandUrl). */
  links: { pdf: string | null; checkout: string | null };
  token: string;
  tz: string | null;
  marketing: boolean;
}

export function buildRewardEmail(i: RewardEmailInput): RewardEmail {
  const { brand: b, reward: r } = i;
  const unsub = unsubscribeUrl(b, i.token);
  const tail = i.marketing ? p(esc(MARKETING_LINE)) : "";
  const tailText = i.marketing ? ["", MARKETING_LINE] : [];
  const done = (subject: string, preheader: string, body: string, text: string[]): RewardEmail => ({
    subject,
    preheader,
    html: shell(b, { preheader, bodyHtml: body + tail, unsub }),
    text: [...text, ...tailText].join("\n") + textFooter(b, unsub),
  });

  if (r.type === "code" && r.code) {
    const exp = formatExpiry(r.code.expiresAt, i.tz);
    const offerShort = r.offerShort ?? r.title;
    const href = i.links.checkout
      ? `${i.links.checkout}${i.links.checkout.includes("?") ? "&" : "?"}code=${encodeURIComponent(r.code.value)}`
      : null;
    const after = "The button applies the code for you. After it expires, the code stops working and can't be renewed.";
    const body = [
      h1(r.title),
      r.offerLine ? p(esc(r.offerLine)) : "",
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr>
        <td style="border:2px dashed ${b.primary};border-radius:8px;padding:14px 22px;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;letter-spacing:.06em;color:${INK};">${esc(r.code.value)}</td>
      </tr></table>`,
      `<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:700;color:${RED_DARK};">Expires ${esc(exp.full)} (24 hours)</p>`,
      href ? button(b, "Use my code", href) : "",
      p(esc(href ? after : "After it expires, the code stops working and can't be renewed.")),
    ].join("\n");
    return done(
      `Your ${offerShort}: code expires in 24 hours`,
      `Use it by ${exp.dayTime} — it's already saved in the browser you used.`,
      body,
      [
        r.title,
        "",
        ...(r.offerLine ? [r.offerLine, ""] : []),
        `Your code: ${r.code.value}`,
        `Expires ${exp.full} (24 hours)`,
        "",
        ...(href ? [`Use my code: ${href}`, "", after] : ["After it expires, the code stops working and can't be renewed."]),
      ],
    );
  }

  if (r.type === "download" && i.links.pdf) {
    const thing = r.thing ?? "printable";
    const pre = r.offerLine ?? `Your free ${thing} is ready to download.`;
    return done(
      `Your free ${thing}: ${r.title}`,
      pre,
      [
        h1(`Here's your free ${thing}`),
        p(esc(r.offerLine ?? `${r.title} is ready whenever you are.`)),
        button(b, `Download ${r.title}`, i.links.pdf),
        p(`If the button doesn't work, copy this link: <a href="${esc(i.links.pdf)}" style="color:${b.primary};">${esc(i.links.pdf)}</a>`),
      ].join("\n"),
      [
        `Here's your free ${thing}: ${r.title}`,
        "",
        ...(r.offerLine ? [r.offerLine, ""] : []),
        `Download ${r.title}: ${i.links.pdf}`,
      ],
    );
  }

  // Series / list — confirmation only for now; phase 2 adds sending.
  const line = r.offerLine ?? `Thanks for signing up. We'll email you as soon as there's something to send.`;
  return done(
    `You're on the list: ${r.offerShort ?? r.title}`,
    line,
    [h1(r.title), p(esc(line))].join("\n"),
    [r.title, "", line],
  );
}
