import { str } from "./core";

/**
 * `reward.product`: the book (or other product) a site wants its popup emails
 * to sell, sent by the site at signup and kept on the subscriber row as
 * `context`. The welcome email shows `main`; the follow-up sequence switches to
 * the edition matching the subscriber's one-tap age answer.
 *
 * Shape mirrors sunlight's src/lib/email-capture/emailProduct.ts. Everything
 * is optional except a title and a page URL, and every link is re-checked
 * against the brand's domain (brandUrl) at send time, so a site can never make
 * us email a third-party link.
 */
export interface EmailProduct {
  id: string;
  title: string;
  edition: string | null;
  /** "2-5" | "4-7" | "7+" for age-banded books. */
  ageBand: string | null;
  url: string;
  amazonUrl: string | null;
  pdfUrl: string | null;
  price: number | null;
  pdfPrice: number | null;
  image: string | null;
  pitch: string | null;
  inside: string[];
}

export interface ProductContext {
  rank: string | null;
  main: EmailProduct;
  editions: EmailProduct[];
  bonus: { title: string; pdf: string; line: string | null } | null;
  quote: { text: string; by: string } | null;
  /** Title of the free printable they signed up for (set from reward.title). */
  received: string | null;
}

function o(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function money(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1000 ? Math.round(v * 100) / 100 : null;
}

export function parseEmailProduct(v: unknown): EmailProduct | null {
  const p = o(v);
  const title = str(p.title, 200);
  const url = str(p.url, 500);
  if (!title || !url) return null;
  const inside = Array.isArray(p.inside)
    ? p.inside.map((x) => str(x, 200)).filter((x): x is string => !!x).slice(0, 6)
    : [];
  return {
    id: str(p.id, 120) ?? title,
    title,
    edition: str(p.edition, 80),
    ageBand: str(p.ageBand, 10),
    url,
    amazonUrl: str(p.amazonUrl, 500),
    pdfUrl: str(p.pdfUrl, 500),
    price: money(p.price),
    pdfPrice: money(p.pdfPrice),
    image: str(p.image, 500),
    pitch: str(p.pitch, 400),
    inside,
  };
}

/** Lenient: a malformed product is dropped (null), never a reason to refuse the signup. */
export function parseProductContext(v: unknown): ProductContext | null {
  const c = o(v);
  const main = parseEmailProduct(c.main);
  if (!main) return null;
  const editions = Array.isArray(c.editions)
    ? c.editions.map(parseEmailProduct).filter((x): x is EmailProduct => !!x).slice(0, 6)
    : [];
  const b = o(c.bonus);
  const bonusTitle = str(b.title, 200);
  const bonusPdf = str(b.pdf, 500);
  const q = o(c.quote);
  const qText = str(q.text, 300);
  const qBy = str(q.by, 120);
  return {
    rank: str(c.rank, 20),
    main,
    editions,
    bonus: bonusTitle && bonusPdf ? { title: bonusTitle, pdf: bonusPdf, line: str(b.line, 400) } : null,
    quote: qText && qBy ? { text: qText, by: qBy } : null,
    received: str(c.received, 200),
  };
}

/**
 * The edition to sell this subscriber: the one matching their age answer
 * ("2–5", "4–7", "7+"), else the one from the page they signed up on.
 * "A mix" and no answer keep `main`.
 */
export function editionFor(ctx: ProductContext, ageAnswer: string | null | undefined): EmailProduct {
  const band = ageAnswer?.replace(/[–—]/g, "-").trim();
  return (band && ctx.editions.find((e) => e.ageBand === band)) || ctx.main;
}
