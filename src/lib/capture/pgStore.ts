import { client as sql } from "@/lib/db/client";
import { newToken, pickOffer } from "./core";
import type { CaptureStore, StatRow, SubscriberRow } from "./store";

/**
 * Postgres implementation of the capture store (tables in
 * src/db/migrations/0001_email_capture.sql). Raw postgres-js rather than drizzle
 * builders: every statement here is an upsert or an atomic increment, which
 * reads more plainly as SQL. Never queries `leads`.
 */

const COUNTERS = { views: 1, closes: 1, clicks: 1, signups: 1 } as const;

/**
 * JSON goes in as text and is cast in SQL (`${j(x)}::text::jsonb`), never via
 * sql.json(). On Vercel, sql.json() objects reached postgres-js's wire writer
 * unserialized ("The \"string\" argument must be of type string… Received an
 * instance of Object", Nov 16) and every signup failed. The ::text cast also
 * stops the driver JSON-encoding the string a second time.
 */
const j = (v: unknown): string | null => (v === null || v === undefined ? null : JSON.stringify(v));

export const pgStore: CaptureStore = {
  async assign(site, offers) {
    if (!offers.length) return null;
    await sql`
      insert into capture_assign ${sql(offers.map((o) => ({ site, offer_id: o, n: 0 })))}
      on conflict do nothing`;
    const rows = await sql<{ offer_id: string; n: string }[]>`
      select offer_id, n from capture_assign
      where site = ${site} and offer_id in ${sql(offers)}`;
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.offer_id] = Number(r.n);
    const pick = pickOffer(offers, counts);
    if (pick) {
      await sql`update capture_assign set n = n + 1 where site = ${site} and offer_id = ${pick}`;
    }
    return pick;
  },

  async bump(site, offer, device, day, field) {
    if (!(field in COUNTERS)) return;
    const col = sql(field);
    await sql`
      insert into capture_stats_daily (site, offer_id, device, day, ${col})
      values (${site}, ${offer}, ${device}, ${day}, 1)
      on conflict (site, offer_id, device, day)
      do update set ${col} = capture_stats_daily.${col} + 1`;
  },

  async upsertSubscriber(input, at) {
    const consent = { ...input.consent, at: at.toISOString(), page: input.page };
    const rows = await sql<(SubscriberRow & { created: boolean })[]>`
      insert into subscribers
        (site, email, marketing, offer_id, variant, page, device, tz, country, utm, consent, code, context, token)
      values
        (${input.site}, ${input.email}, ${input.marketing}, ${input.offer}, ${input.variant},
         ${input.page}, ${input.device}, ${input.tz}, ${input.country},
         ${j(input.utm)}::text::jsonb, ${j(consent)}::text::jsonb,
         ${j(input.reward.code ?? null)}::text::jsonb, ${j(input.reward.product ?? null)}::text::jsonb,
         ${newToken()})
      on conflict (site, email) do update set
        marketing = excluded.marketing,
        offer_id = excluded.offer_id,
        variant = excluded.variant,
        page = excluded.page,
        device = excluded.device,
        tz = excluded.tz,
        country = excluded.country,
        utm = excluded.utm,
        consent = excluded.consent,
        code = excluded.code,
        context = coalesce(excluded.context, subscribers.context),
        status = case when subscribers.status = 'unsubscribed' then 'active' else subscribers.status end,
        unsubscribed_at = case when subscribers.status = 'unsubscribed' then null else subscribers.unsubscribed_at end,
        updated_at = now()
      returning *, (xmax = 0) as created`;
    const { created, ...row } = rows[0];
    return { row: row as SubscriberRow, created };
  },

  async mergeAnswer(token, question, answer) {
    const rows = await sql`
      update subscribers
      set answers = answers || ${j({ [question]: answer })}::text::jsonb, updated_at = now()
      where token = ${token}
      returning id`;
    return rows.length > 0;
  },

  async unsubscribe(token, at) {
    const rows = await sql<SubscriberRow[]>`
      update subscribers set
        status = case when status = 'active' then 'unsubscribed' else status end,
        unsubscribed_at = coalesce(unsubscribed_at, ${at.toISOString()}),
        updated_at = now()
      where token = ${token}
      returning *`;
    return rows[0] ?? null;
  },

  async setStatusByEmail(email, status, site) {
    const rows = site
      ? await sql`update subscribers set status = ${status}, updated_at = now()
                  where email = ${email} and site = ${site} and status <> ${status} returning id`
      : await sql`update subscribers set status = ${status}, updated_at = now()
                  where email = ${email} and status <> ${status} returning id`;
    return rows.length;
  },

  async stats(fromDay, toDay) {
    const rows = toDay
      ? await sql<StatRow[]>`
          select site, offer_id, device, to_char(day, 'YYYY-MM-DD') as day, views, closes, clicks, signups
          from capture_stats_daily where day >= ${fromDay} and day <= ${toDay}
          order by site, offer_id, device, day`
      : await sql<StatRow[]>`
          select site, offer_id, device, to_char(day, 'YYYY-MM-DD') as day, views, closes, clicks, signups
          from capture_stats_daily where day >= ${fromDay}
          order by site, offer_id, device, day`;
    return rows.map((r) => ({ ...r }));
  },

  async recipients(q) {
    const from = q.createdFrom ? q.createdFrom.toISOString() : null;
    const rows = await sql<SubscriberRow[]>`
      select s.* from subscribers s
      where s.site = ${q.site}
        and s.status = 'active'
        and s.marketing
        and s.created_at < ${q.createdTo.toISOString()}
        and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
        and (${q.requireContext ?? false} = false or s.context is not null)
        and not exists (select 1 from capture_sends c where c.subscriber_id = s.id and c.key = ${q.withoutKey})
      order by s.created_at
      limit ${q.limit}`;
    return rows.map((r) => ({ ...r }));
  },

  async claimSend(subscriberId, key) {
    const rows = await sql`
      insert into capture_sends (subscriber_id, key) values (${subscriberId}, ${key})
      on conflict do nothing returning key`;
    return rows.length > 0;
  },

  async finishSend(subscriberId, key, emailId) {
    await sql`update capture_sends set email_id = ${emailId}, sent_at = now()
              where subscriber_id = ${subscriberId} and key = ${key}`;
  },

  async releaseSend(subscriberId, key) {
    await sql`delete from capture_sends where subscriber_id = ${subscriberId} and key = ${key}`;
  },

  async paidBookIds(email) {
    const rows = await sql<{ book_id: string }[]>`
      select distinct book_id from sk_orders
      where lower(email) = ${email.toLowerCase()} and status = 'paid' and revoked_at is null`;
    return rows.map((r) => r.book_id);
  },

  async subscriberCounts() {
    const rows = await sql<{ site: string; status: string; n: number }[]>`
      select site, status, count(*)::int as n from subscribers group by site, status order by site, status`;
    return rows.map((r) => ({ ...r }));
  },
};
