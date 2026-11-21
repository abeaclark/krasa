import type { Brand } from "@/lib/email/brands";
import { brandUrl } from "@/lib/email/brands";
import { FONT, MUTED, button, esc, h1, p } from "@/lib/email/kit";
import { fullTitle, h2, hr, link, productCard, quoteBlock, resolveProduct, usd } from "@/lib/email/productBlocks";
import { editionFor, type EmailProduct, type ProductContext } from "./product";
import type { SubscriberRow } from "./store";

/**
 * The follow-up sequence after a popup signup: three emails over nine days,
 * each built from the subscriber's `context` (the book the site matched to
 * their signup page) and their one-tap age answer.
 *
 *   day 2  a second free printable, with a light mention of the book
 *   day 5  the book: paperback on Amazon or the $4.99 Download & Print PDF
 *   day 9  a real customer quote and the book's other age editions
 *
 * Only active, marketing-OK subscribers with a context get it (store.recipients).
 * A step is sent at most once (capture_sends) and never more than LATE_HOURS
 * after it fell due, so a cron outage or a backfill can't mail someone a "day 2"
 * email three weeks later. Signups from before this shipped have no context and
 * get nothing.
 *
 * Copy is per site: only Sunlight Kids has a sequence today.
 */

export const LATE_HOURS = 72;

export interface StepInput {
  brand: Brand;
  sub: SubscriberRow;
  ctx: ProductContext;
  /** The edition matching their age answer, links resolved. */
  edition: EmailProduct;
  /** Every edition, links resolved, youngest first. */
  editions: EmailProduct[];
  /** Book ids they already bought as a PDF. */
  paid: string[];
}

/** subject + preheader + body; the runner adds the shell, footer and unsubscribe. */
export interface Built {
  subject: string;
  preheader: string;
  html: string;
  text: string[];
}

export interface SequenceStep {
  key: string;
  afterHours: number;
  /** null = deliberately not sent to this person (recorded as "skipped"). */
  build(i: StepInput): Built | null;
}

/** The age answer as the popup stored it ("How old are your kids?"). */
export function ageAnswer(sub: SubscriberRow): string | null {
  const a = sub.answers ?? {};
  return a["How old are your kids?"] ?? Object.values(a)[0] ?? null;
}

const sunlightDay2: SequenceStep = {
  key: "d2-bonus",
  afterHours: 48,
  build({ brand: b, ctx, edition }) {
    const pdf = ctx.bonus ? brandUrl(b, ctx.bonus.pdf) : null;
    if (!ctx.bonus || !pdf) return null;
    const bonus = ctx.bonus;
    const hope = ctx.received ? `We hope the ${ctx.received} went over well. ` : "";
    const book = fullTitle(edition);
    return {
      subject: `Another free printable: ${bonus.title}`,
      preheader: bonus.line ?? `${bonus.title}, free to print.`,
      html: [
        h1("One more, on us"),
        p(esc(`${hope}Here's another free printable for a rainy afternoon or a long wait.`)),
        bonus.line ? p(esc(bonus.line)) : "",
        button(b, `Download ${bonus.title}`, pdf),
        hr,
        p(`If they're into these, ${link(b, book, edition.url)} has a whole book of them.`),
      ].join("\n"),
      text: [
        "One more, on us",
        "",
        `${hope}Here's another free printable for a rainy afternoon or a long wait.`,
        ...(bonus.line ? ["", bonus.line] : []),
        "",
        `Download ${bonus.title}: ${pdf}`,
        "",
        `If they're into these, ${book} has a whole book of them: ${edition.url}`,
      ],
    };
  },
};

const sunlightDay5: SequenceStep = {
  key: "d5-book",
  afterHours: 120,
  build({ brand: b, edition, paid }) {
    if (paid.includes(edition.id)) return null;
    const card = productCard(b, edition, { inside: true });
    const how = [
      edition.amazonUrl ? "The paperback ships from Amazon." : "",
      edition.pdfUrl
        ? "The Download & Print PDF is emailed to you right after checkout, so you can print it tonight."
        : "",
    ].filter(Boolean).join(" ");
    return {
      subject: edition.amazonUrl && edition.pdfUrl
        ? `${edition.title}: paperback or print at home`
        : edition.title,
      preheader: edition.pitch ?? fullTitle(edition),
      html: [h1(fullTitle(edition)), card.html, how ? p(esc(how)) : ""].join("\n"),
      text: [...card.text, ...(how ? ["", how] : [])],
    };
  },
};

const sunlightDay9: SequenceStep = {
  key: "d9-proof",
  afterHours: 216,
  build({ brand: b, ctx, edition, editions, paid }) {
    const others = editions.filter((e) => e.id !== edition.id && !paid.includes(e.id));
    const showCard = !paid.includes(edition.id);
    if (!ctx.quote && !others.length) return null;

    const html: string[] = [];
    const text: string[] = [];
    if (ctx.quote) {
      const q = quoteBlock(ctx.quote);
      html.push(h1("What parents tell us"), q.html);
      text.push("What parents tell us", "", ...q.text);
    } else {
      html.push(h1("A book for every age"));
      text.push("A book for every age");
    }
    if (showCard) {
      const card = productCard(b, edition);
      html.push(card.html);
      text.push("", ...card.text);
    }
    if (others.length) {
      const formats = (e: EmailProduct) =>
        [e.amazonUrl ? "paperback" : "", e.pdfPrice ? `${usd(e.pdfPrice)} PDF` : ""].filter(Boolean).join(" or ");
      const items = others.map((e) => {
        const f = formats(e);
        return `${link(b, e.edition ?? e.title, e.url)}${f ? ` <span style="color:${MUTED};">· ${esc(f)}</span>` : ""}`;
      });
      html.push(
        hr,
        h2("Different ages at home?"),
        p(esc(`${edition.title} comes in ${others.length + 1} editions, each sized for the age:`)),
        `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.7;">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
      );
      text.push("", "Different ages at home?", ...others.map((e) => `- ${e.edition ?? e.title}: ${e.url}`));
    }
    return {
      subject: ctx.quote ? `"${trimWords(ctx.quote.text, 9)}"` : `${edition.title}, for every age`,
      preheader: ctx.quote ? `${ctx.quote.by}` : `${edition.title} comes in an edition for each age.`,
      html: html.join("\n"),
      text,
    };
  },
};

function trimWords(s: string, n: number): string {
  const w = s.replace(/[.!?]+$/, "").split(/\s+/);
  return w.length <= n ? w.join(" ") : `${w.slice(0, n).join(" ")}…`;
}

export const SEQUENCES: Record<string, SequenceStep[]> = {
  "sunlightkids.com": [sunlightDay2, sunlightDay5, sunlightDay9],
};

/** Resolve the context's links for one subscriber; null when its main page link fails. */
export function stepInput(brand: Brand, sub: SubscriberRow, paid: string[]): StepInput | null {
  const ctx = sub.context;
  if (!ctx) return null;
  const pick = editionFor(ctx, ageAnswer(sub));
  const edition = resolveProduct(brand, pick) ?? resolveProduct(brand, ctx.main);
  if (!edition) return null;
  const editions = ctx.editions.map((e) => resolveProduct(brand, e)).filter((e): e is EmailProduct => !!e);
  return { brand, sub, ctx, edition, editions, paid };
}
