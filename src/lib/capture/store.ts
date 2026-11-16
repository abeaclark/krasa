import { newToken, pickOffer, type CounterT, type SubscribeInput } from "./core";

/**
 * Storage behind the capture routes. Two implementations: Postgres
 * (pgStore.ts, production) and in-memory (below, tests). Neither touches
 * the `leads` table.
 */

export type SubscriberStatus = "active" | "unsubscribed" | "bounced" | "complained";

export interface SubscriberRow {
  id: string;
  site: string;
  email: string;
  status: SubscriberStatus;
  marketing: boolean;
  offer_id: string | null;
  page: string | null;
  tz: string | null;
  answers: Record<string, string>;
  code: { value: string; expiresAt: string } | null;
  token: string;
  unsubscribed_at: string | Date | null;
}

export interface StatRow {
  site: string;
  offer_id: string;
  device: string;
  day: string;
  views: number;
  closes: number;
  clicks: number;
  signups: number;
}

export interface CaptureStore {
  /** Round robin over `offers`; returns the pick and counts it. */
  assign(site: string, offers: string[]): Promise<string | null>;
  bump(site: string, offer: string, device: string, day: string, field: CounterT): Promise<void>;
  /** Insert, or update the existing (site, email) row. */
  upsertSubscriber(input: SubscribeInput, at: Date): Promise<{ row: SubscriberRow; created: boolean }>;
  mergeAnswer(token: string, question: string, answer: string): Promise<boolean>;
  /** Idempotent. Returns the row, or null for an unknown token. */
  unsubscribe(token: string, at: Date): Promise<SubscriberRow | null>;
  /** Bounce / complaint from the mail provider. Returns rows changed. */
  setStatusByEmail(email: string, status: "bounced" | "complained", site?: string | null): Promise<number>;
  stats(fromDay: string, toDay?: string): Promise<StatRow[]>;
  subscriberCounts(): Promise<{ site: string; status: string; n: number }[]>;
}

export function memoryStore(): CaptureStore & {
  subscribers: SubscriberRow[];
  statRows: StatRow[];
  counts: Record<string, Record<string, number>>;
} {
  const subscribers: SubscriberRow[] = [];
  const statRows: StatRow[] = [];
  const counts: Record<string, Record<string, number>> = {};
  let seq = 0;

  return {
    subscribers,
    statRows,
    counts,
    async assign(site, offers) {
      const c = (counts[site] ??= {});
      const pick = pickOffer(offers, c);
      if (pick) c[pick] = (c[pick] ?? 0) + 1;
      return pick;
    },
    async bump(site, offer, device, day, field) {
      let row = statRows.find(
        (r) => r.site === site && r.offer_id === offer && r.device === device && r.day === day,
      );
      if (!row) {
        row = { site, offer_id: offer, device, day, views: 0, closes: 0, clicks: 0, signups: 0 };
        statRows.push(row);
      }
      row[field] += 1;
    },
    async upsertSubscriber(input) {
      const existing = subscribers.find((s) => s.site === input.site && s.email === input.email);
      if (existing) {
        existing.offer_id = input.offer;
        existing.page = input.page;
        existing.tz = input.tz;
        existing.code = input.reward.code;
        existing.marketing = input.marketing;
        if (existing.status === "unsubscribed") {
          existing.status = "active";
          existing.unsubscribed_at = null;
        }
        return { row: existing, created: false };
      }
      const row: SubscriberRow = {
        id: `mem-${++seq}`,
        site: input.site,
        email: input.email,
        status: "active",
        marketing: input.marketing,
        offer_id: input.offer,
        page: input.page,
        tz: input.tz,
        answers: {},
        code: input.reward.code,
        token: newToken(),
        unsubscribed_at: null,
      };
      subscribers.push(row);
      return { row, created: true };
    },
    async mergeAnswer(token, question, answer) {
      const row = subscribers.find((s) => s.token === token);
      if (!row) return false;
      row.answers = { ...row.answers, [question]: answer };
      return true;
    },
    async unsubscribe(token, at) {
      const row = subscribers.find((s) => s.token === token);
      if (!row) return null;
      if (row.status !== "unsubscribed") {
        // A bounce or complaint is a stronger "stop" than unsubscribed; keep it.
        if (row.status === "active") row.status = "unsubscribed";
        row.unsubscribed_at ??= at.toISOString();
      }
      return row;
    },
    async setStatusByEmail(email, status, site) {
      let n = 0;
      for (const s of subscribers) {
        if (s.email === email && (!site || s.site === site) && s.status !== status) {
          s.status = status;
          n++;
        }
      }
      return n;
    },
    async stats(fromDay, toDay) {
      return statRows.filter((r) => r.day >= fromDay && (!toDay || r.day <= toDay));
    },
    async subscriberCounts() {
      const m = new Map<string, number>();
      for (const s of subscribers) m.set(`${s.site}|${s.status}`, (m.get(`${s.site}|${s.status}`) ?? 0) + 1);
      return [...m].map(([k, n]) => ({ site: k.split("|")[0], status: k.split("|")[1], n }));
    },
  };
}
