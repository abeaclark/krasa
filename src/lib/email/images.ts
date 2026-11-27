/**
 * Pre-send image check for brand email.
 *
 * Every <img> in a brand email must answer 200 with an image/* content type
 * before we send. Gmail and Outlook fetch images through their proxies when
 * the email is opened; a URL that fails shows as a grey "?" box and makes the
 * email look like spam. (Nov 27, 2026: Sunlight's /api/email/cover route 500'd
 * and the Black Friday send went out with broken covers.)
 *
 * A broken image is removed from the email (with its wrapping link) rather
 * than blocking the send, and reported so it gets fixed. Results are cached
 * for 10 minutes per URL so a batch of 200 sends checks each cover once.
 */

const OK_TTL = 10 * 60_000;
const BAD_TTL = 60_000;
const cache = new Map<string, { ok: boolean; at: number }>();

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export async function imageOk(url: string, fetchFn: FetchFn = fetch, now = Date.now()): Promise<boolean> {
  const hit = cache.get(url);
  if (hit && now - hit.at < (hit.ok ? OK_TTL : BAD_TTL)) return hit.ok;
  let ok = false;
  try {
    const res = await fetchFn(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    ok = res.ok && (res.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
    await res.body?.cancel().catch(() => {});
  } catch {
    ok = false;
  }
  cache.set(url, { ok, at: now });
  return ok;
}

export function clearImageCache() {
  cache.clear();
}

const IMG = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;

const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Absolute image URLs in an HTML email. */
export function imageUrls(html: string): string[] {
  return [...new Set([...html.matchAll(IMG)].map((m) => unesc(m[1])))];
}

/**
 * Returns the HTML with every broken image removed (an <a> that only wraps
 * the image goes too) and the list of broken URLs.
 */
export async function dropBrokenImages(html: string, fetchFn: FetchFn = fetch): Promise<{ html: string; broken: string[] }> {
  const urls = imageUrls(html);
  if (!urls.length) return { html, broken: [] };
  const results = await Promise.all(urls.map(async (u) => [u, await imageOk(u, fetchFn)] as const));
  const broken = results.filter(([, ok]) => !ok).map(([u]) => u);
  if (!broken.length) return { html, broken };
  const bad = new Set(broken);
  const out = html
    .replace(/<a\b[^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi, (whole, img: string) => {
      const src = img.match(/\bsrc="([^"]+)"/i)?.[1];
      return src && bad.has(unesc(src)) ? "" : whole;
    })
    .replace(IMG, (whole, src: string) => (bad.has(unesc(src)) ? "" : whole));
  return { html: out, broken };
}
