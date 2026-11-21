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

import { FONT, INK, RED_DARK, button, esc, h1, p, shell, textFooter } from "./kit";
import { productCard, resolveProduct, h2, hr } from "./productBlocks";
import type { ProductContext } from "@/lib/capture/product";

export { esc } from "./kit";

const MARKETING_LINE =
  "From time to time we'll also send tips and offers. Unsubscribe with one click below.";

/**
 * "Want more like this?" — the book the site matched to this signup, under the
 * download. Marketing, so it's left out when the subscriber didn't opt in
 * (EU/UK/CA box unticked); the download itself always goes.
 */
function moreLikeThis(b: Brand, ctx: ProductContext | null): { html: string; text: string[] } | null {
  const prod = ctx ? resolveProduct(b, ctx.main) : null;
  if (!prod) return null;
  const card = productCard(b, prod);
  return {
    html: [hr, h2("Want more like this?"), card.html].join("\n"),
    text: ["Want more like this?", "", ...card.text],
  };
}

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
    const more = i.marketing ? moreLikeThis(b, r.product) : null;
    return done(
      `Your free ${thing}: ${r.title}`,
      pre,
      [
        h1(`Here's your free ${thing}`),
        p(esc(r.offerLine ?? `${r.title} is ready whenever you are.`)),
        button(b, `Download ${r.title}`, i.links.pdf),
        p(`If the button doesn't work, copy this link: <a href="${esc(i.links.pdf)}" style="color:${b.primary};">${esc(i.links.pdf)}</a>`),
        more?.html ?? "",
      ].join("\n"),
      [
        `Here's your free ${thing}: ${r.title}`,
        "",
        ...(r.offerLine ? [r.offerLine, ""] : []),
        `Download ${r.title}: ${i.links.pdf}`,
        ...(more ? ["", "—", "", ...more.text] : []),
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
