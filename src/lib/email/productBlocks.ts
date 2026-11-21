import type { Brand } from "./brands";
import { brandUrl } from "./brands";
import { BODY, FONT, INK, LINE, MUTED, button, esc } from "./kit";
import type { EmailProduct } from "@/lib/capture/product";

/**
 * Building blocks for emails that sell a product (the welcome email's book,
 * the follow-up sequence, the seasonal sends). HTML and plain text are always
 * built together so the two parts never disagree.
 *
 * Every link goes through brandUrl first: a product whose page URL isn't on
 * the brand's domain is dropped, and so is any button whose link isn't.
 */

export interface Part {
  html: string;
  text: string[];
}

/** A product with every link made absolute and checked, or null if its page link fails. */
export function resolveProduct(b: Brand, p: EmailProduct): EmailProduct | null {
  const url = brandUrl(b, p.url);
  if (!url) return null;
  return {
    ...p,
    url,
    amazonUrl: brandUrl(b, p.amazonUrl),
    pdfUrl: brandUrl(b, p.pdfUrl),
    image: brandUrl(b, p.image),
  };
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

export function fullTitle(p: EmailProduct): string {
  return p.edition && p.ageBand ? `${p.title} (${p.edition})` : p.title;
}

export const h2 = (text: string) =>
  `<h2 style="margin:0 0 10px;font-family:${FONT};font-size:19px;line-height:1.3;color:${INK};">${esc(text)}</h2>`;

export const hr = `<hr style="border:0;border-top:1px solid ${LINE};margin:24px 0;">`;

export function link(b: Brand, label: string, href: string): string {
  return `<a href="${esc(href)}" style="color:${b.primary};font-weight:700;">${esc(label)}</a>`;
}

export function bullets(items: string[]): string {
  if (!items.length) return "";
  return `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.55;color:${BODY};">${items
    .map((i) => `<li style="margin:0 0 4px;">${esc(i)}</li>`)
    .join("")}</ul>`;
}

/** Paperback button + PDF link (or PDF button when there's no paperback). */
export function buyButtons(b: Brand, p: EmailProduct): Part {
  const html: string[] = [];
  const text: string[] = [];
  if (p.amazonUrl) {
    const label = p.price ? `Get the paperback · ${usd(p.price)}` : "Get the paperback on Amazon";
    html.push(button(b, label, p.amazonUrl));
    text.push(`${label} (Amazon): ${p.amazonUrl}`);
    if (p.pdfUrl && p.pdfPrice) {
      html.push(
        `<p style="margin:-6px 0 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${BODY};">Or ${link(b, `download & print it at home · ${usd(p.pdfPrice)}`, p.pdfUrl)}</p>`,
      );
      text.push(`Or download & print it at home (${usd(p.pdfPrice)}): ${p.pdfUrl}`);
    }
  } else if (p.pdfUrl) {
    const label = p.pdfPrice ? `Download & print · ${usd(p.pdfPrice)}` : "Download & print";
    html.push(button(b, label, p.pdfUrl));
    text.push(`${label}: ${p.pdfUrl}`);
  } else {
    html.push(button(b, "See the book", p.url));
    text.push(`See the book: ${p.url}`);
  }
  return { html: html.join("\n"), text };
}

/** Cover, title, pitch and buy buttons. */
export function productCard(b: Brand, p: EmailProduct, opts: { inside?: boolean } = {}): Part {
  const title = fullTitle(p);
  const cover = p.image
    ? `<a href="${esc(p.url)}"><img src="${esc(p.image)}" width="180" alt="${esc(title)} cover" style="display:block;width:180px;max-width:100%;height:auto;border:1px solid ${LINE};border-radius:4px;margin:0 0 14px;"></a>`
    : "";
  const buy = buyButtons(b, p);
  const inside = opts.inside ? p.inside.slice(0, 4) : [];
  const html = [
    cover,
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:17px;line-height:1.35;font-weight:700;color:${INK};"><a href="${esc(p.url)}" style="color:${INK};text-decoration:none;">${esc(title)}</a></p>`,
    p.pitch ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.55;color:${BODY};">${esc(p.pitch)}</p>` : "",
    inside.length
      ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;font-weight:700;color:${MUTED};">What's inside</p>${bullets(inside)}`
      : "",
    buy.html,
  ].join("\n");
  const text = [
    title,
    ...(p.pitch ? [p.pitch] : []),
    ...(inside.length ? ["", "What's inside:", ...inside.map((i) => `- ${i}`)] : []),
    "",
    ...buy.text,
    `About the book: ${p.url}`,
  ];
  return { html, text };
}

/** A real customer quote, set off from the body. */
export function quoteBlock(q: { text: string; by: string }): Part {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td style="border-left:3px solid ${LINE};padding:4px 0 4px 14px;font-family:${FONT};">
      <p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:${INK};font-style:italic;">&ldquo;${esc(q.text)}&rdquo;</p>
      <p style="margin:0;font-size:13px;line-height:1.4;color:${MUTED};">${esc(q.by)}</p>
    </td></tr></table>`,
    text: [`"${q.text}"`, `— ${q.by}`],
  };
}
