import type { StatRow } from "./store";

/**
 * The daily Slack digest: one message, per site, yesterday's views, signups,
 * clicks and signup rate per offer. No per-signup pings, ever.
 */
export function buildDigest(day: string, rows: StatRow[]): string | null {
  const bySite = new Map<string, Map<string, { views: number; signups: number; clicks: number }>>();
  for (const r of rows) {
    const offers = bySite.get(r.site) ?? new Map();
    const t = offers.get(r.offer_id) ?? { views: 0, signups: 0, clicks: 0 };
    t.views += r.views;
    t.signups += r.signups;
    t.clicks += r.clicks;
    offers.set(r.offer_id, t);
    bySite.set(r.site, offers);
  }
  if (!bySite.size) return null;

  const lines = [`*Email popup — ${day}*`];
  for (const site of [...bySite.keys()].sort()) {
    lines.push(`*${site}*`);
    const offers = bySite.get(site)!;
    for (const id of [...offers.keys()].sort()) {
      const t = offers.get(id)!;
      const rate = t.views ? `${((t.signups / t.views) * 100).toFixed(1)}%` : "n/a";
      lines.push(`• \`${id}\` — ${t.views} views · ${t.signups} signups · ${t.clicks} clicks · ${rate} signup rate`);
    }
  }
  return lines.join("\n");
}
