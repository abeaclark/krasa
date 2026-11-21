import type { Brand } from "./brands";

/**
 * The table-based, inline-styled shell and pieces shared by every brand email
 * (popup reward, follow-ups, seasonal sends). Same approach as layout.ts, but
 * themed per brand.
 */

export const INK = "#16171d";
export const BODY = "#3f4250";
export const MUTED = "#6b6e7b";
export const LINE = "#e6e6e1";
const PAPER = "#f6f6f3";
export const RED_DARK = "#a3062f";
export const FONT = "Helvetica,Arial,sans-serif";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const p = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${BODY};">${html}</p>`;

export const h1 = (text: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.25;color:${INK};">${esc(text)}</h1>`;

export function button(b: Brand, label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">
  <tr><td align="center" bgcolor="${b.primary}" style="border-radius:8px;">
    <a href="${esc(href)}" style="display:inline-block;padding:15px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

export function shell(b: Brand, opts: { preheader: string; bodyHtml: string; unsub: string }): string {
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

export function textFooter(b: Brand, unsub: string): string {
  return ["", "—", `${b.legalName} · ${b.postalAddress}`, `Privacy: ${b.privacyUrl}`, `Unsubscribe: ${unsub}`].join("\n");
}
