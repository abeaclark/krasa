import { newToken, pickOffer, type CounterT, type SubscribeInput } from "./core";
import type { ProductContext } from "./product";

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
  /** reward.product from the latest signup (product.ts). */
  context: ProductContext | null;
  token: string;
  created_at: string | Date;
  unsubscribed_at: string | Date | null;
}

/** Who a follow-up or campaign may go to. Only ever active, marketing-OK rows. */
export interface RecipientQuery {
  site: string;
  /** Signed up at or after this (inclusive). */
  createdFrom?: Date;
  /** Signed up before this (exclusive). */
  createdTo: Date;
  /** Skip anyone who already has a capture_sends row with this key. */
  withoutKey: string;
  /** Only rows with a product context. */
  requireContext?: boolean;
  limit: number;
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
  /** Oldest first. Never returns unsubscribed, bounced, complained or marketing=false rows. */
  recipients(q: RecipientQuery): Promise<SubscriberRow[]>;
  /** Reserve (subscriber, key) before sending. False if someone already has it. */
  claimSend(subscriberId: string, key: string): Promise<boolean>;
  /** Record the provider id (or "skipped") on a claimed send. */
  finishSend(subscriberId: string, key: string, emailId: string | null): Promise<void>;
  /** Undo a claim whose send failed, so the next run retries it. */
  releaseSend(subscriberId: string, key: string): Promise<void>;
  /** Book ids this address has a paid Sunlight Kids PDF order for (sk_orders). */
  paidBookIds(email: string): Promise<string[]>;
  subscriberCounts(): Promise<{ site: string; status: string; n: number }[]>;
}

export function memoryStore(): CaptureStore & {
  subscribers: SubscriberRow[];
  statRows: StatRow[];
  counts: Record<string, Record<string, number>>;
  sends: Map<string, string | null>;
  paidOrders: { email: string; book_id: string }[];
} {
  const subscribers: SubscriberRow[] = [];
  const statRows: StatRow[] = [];
  const counts: Record<string, Record<string, number>> = {};
  const sends = new Map<string, string | null>(); // `${subscriberId}|${key}` → email id
  const paidOrders: { email: string; book_id: string }[] = [];
  let seq = 0;

  return {
    subscribers,
    statRows,
    counts,
    sends,
    paidOrders,
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
    async upsertSubscriber(input, at) {
      const existing = subscribers.find((s) => s.site === input.site && s.email === input.email);
      if (existing) {
        existing.offer_id = input.offer;
        existing.page = input.page;
        existing.tz = input.tz;
        existing.code = input.reward.code;
        existing.context = input.reward.product ?? existing.context;
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
        context: input.reward.product,
        token: newToken(),
        created_at: at.toISOString(),
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
    async recipients(q) {
      const t = (d: string | Date) => new Date(d).getTime();
      return subscribers
        .filter(
          (s) =>
            s.site === q.site &&
            s.status === "active" &&
            s.marketing &&
            (!q.requireContext || s.context) &&
            (!q.createdFrom || t(s.created_at) >= q.createdFrom.getTime()) &&
            t(s.created_at) < q.createdTo.getTime() &&
            !sends.has(`${s.id}|${q.withoutKey}`),
        )
        .sort((a, b) => t(a.created_at) - t(b.created_at))
        .slice(0, q.limit);
    },
    async claimSend(id, key) {
      const k = `${id}|${key}`;
      if (sends.has(k)) return false;
      sends.set(k, null);
      return true;
    },
    async finishSend(id, key, emailId) {
      sends.set(`${id}|${key}`, emailId);
    },
    async releaseSend(id, key) {
      sends.delete(`${id}|${key}`);
    },
    async paidBookIds(email) {
      return paidOrders.filter((o) => o.email === email.toLowerCase()).map((o) => o.book_id);
    },
    async subscriberCounts() {
      const m = new Map<string, number>();
      for (const s of subscribers) m.set(`${s.site}|${s.status}`, (m.get(`${s.site}|${s.status}`) ?? 0) + 1);
      return [...m].map(([k, n]) => ({ site: k.split("|")[0], status: k.split("|")[1], n }));
    },
  };
}
