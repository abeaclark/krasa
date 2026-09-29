import { EMAIL } from "./config";

/**
 * Shared HTML shell for every message we send.
 *
 * Email clients are not browsers. This deliberately uses tables, inline
 * styles, web-safe fonts and no external assets — a layout that survives
 * Outlook, Gmail's CSS stripping, and a dark-mode client inverting everything.
 * Every message also ships a real plain-text alternative, which matters both
 * for accessibility and because text/plain-only recipients otherwise get a
 * wall of markup.
 */

const INK = "#131c18";
const BODY = "#3d4a44";
const MUTED = "#6b7a73";
const ACCENT = "#15624a";
const LINE = "#e2e6e1";
const PAPER = "#f6f7f4";

export interface Button {
  label: string;
  href: string;
  /** The visually dominant option. At most one per message. */
  primary?: boolean;
}

export function button(b: Button): string {
  const bg = b.primary ? ACCENT : "#ffffff";
  const fg = b.primary ? "#ffffff" : INK;
  const border = b.primary ? ACCENT : LINE;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 8px 10px 0;display:inline-table;">
  <tr><td align="center" bgcolor="${bg}" style="border:1px solid ${border};border-radius:6px;">
    <a href="${b.href}" style="display:inline-block;padding:13px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:${fg};text-decoration:none;">${b.label}</a>
  </td></tr></table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${BODY};">${text}</p>`;
}

/**
 * Wraps body HTML in the full document, with the footer CAN-SPAM requires.
 *
 * `unsubscribeUrl` is omitted for transactional mail — someone who just asked
 * for their letters is not being marketed to, and offering to unsubscribe them
 * from their own delivery is a confusing thing to do.
 */
export function wrap(opts: {
  preheader: string;
  bodyHtml: string;
  unsubscribeUrl?: string;
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${EMAIL.brand}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:10px;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:.02em;color:${ACCENT};">${EMAIL.brand}</p>
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:8px 28px 28px;">
        <hr style="border:0;border-top:1px solid ${LINE};margin:16px 0;">
        <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
          ${EMAIL.legalName} &middot; ${EMAIL.postalAddress}<br>
          Questions? Just reply to this email &mdash; it reaches a person.
        </p>
        ${
          opts.unsubscribeUrl
            ? `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};"><a href="${opts.unsubscribeUrl}" style="color:${MUTED};">Unsubscribe from these emails</a></p>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Footer for the plain-text alternative. Same obligations apply. */
export function textFooter(unsubscribeUrl?: string): string {
  return [
    "",
    "—",
    `${EMAIL.legalName} · ${EMAIL.postalAddress}`,
    "Questions? Just reply to this email — it reaches a person.",
    ...(unsubscribeUrl ? [`Unsubscribe from these emails: ${unsubscribeUrl}`] : []),
  ].join("\n");
}
