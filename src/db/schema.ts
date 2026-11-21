import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  uuid,
  text,
  index,
  boolean,
  integer,
  bigint,
  date,
  primaryKey,
  uniqueIndex,
  bigserial,
  foreignKey,
} from "drizzle-orm/pg-core";
import { InferSelectModel, InferInsertModel, sql } from "drizzle-orm";
import type { LeadStatusT } from "@/lib/enums";

/**
 * leads — the single table behind the global lead/CRM backend.
 *
 * Design notes:
 *  - One row per submission across every site (krasadev.com, krasa.ai,
 *    localservicegroup.com, refundauto.com, sunlightkids.com).
 *  - `site` attributes the lead to its origin; `source` records which form /
 *    page it came from (e.g. "contact", "quote", "consultation", "refund-funnel").
 *  - Core CRM fields (name/email/phone/message) are shared columns. Anything
 *    site-specific lives in `meta` (jsonb) so we never need a migration to
 *    capture a new per-site field.
 *  - `status` is a code enum (plain varchar typed as LeadStatusT), not a DB
 *    enum, so the pipeline can evolve without migrations.
 *  - `created_at` is the received date; `updated_at` tracks status changes.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    // Attribution
    site: varchar("site").notNull(), // e.g. "krasadev.com"
    source: varchar("source"), // form / page identifier, e.g. "contact"

    // Pipeline state — code enum, not a DB enum (see lib/enums.ts)
    status: varchar("status").$type<LeadStatusT>().default("new").notNull(),

    // Core CRM fields (shared across every site)
    name: varchar("name"),
    email: varchar("email"),
    phone: varchar("phone"),
    message: text("message"),

    // Flexible per-site metadata (service requested, vehicle details, UTM, etc.)
    meta: jsonb("meta")
      .default(sql`'{}'::jsonb`)
      .notNull(),

    // Timestamps — created_at is the "received" date.
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("leads_site_idx").on(t.site),
    index("leads_status_idx").on(t.status),
    index("leads_created_at_idx").on(t.created_at),
    index("leads_email_idx").on(t.email),
  ],
);

export type Lead = InferSelectModel<typeof leads>;
export type NewLead = InferInsertModel<typeof leads>;

/**
 * heartbeats — keep-alive ping log.
 *
 * Supabase pauses free-tier projects that go too long without DB activity.
 * A Vercel cron hits /api/cron/heartbeat once a day and inserts one row here,
 * which is enough write activity to keep the project from being paused. The
 * table doubles as a simple uptime/liveness audit trail.
 */
export const heartbeats = pgTable(
  "heartbeats",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    // Where the ping came from, e.g. "vercel-cron".
    source: varchar("source").default("vercel-cron").notNull(),

    // Optional free-form details (region, deployment id, etc.).
    meta: jsonb("meta")
      .default(sql`'{}'::jsonb`)
      .notNull(),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("heartbeats_created_at_idx").on(t.created_at)],
);

export type Heartbeat = InferSelectModel<typeof heartbeats>;
export type NewHeartbeat = InferInsertModel<typeof heartbeats>;

/**
 * sk_orders / sk_download_events — Sunlight Kids "Download & Print" orders.
 *
 * Created by supabase/0003 + 0004 and used only by sunlightkids.com's server
 * (service-role key); Krasa's code never reads them. They're modelled here so
 * drizzle-kit knows they exist and never offers to drop them. The trigger,
 * the sk_claim_download() function and the grants from 0003 stay as they are:
 * drizzle doesn't manage those. Constraint names match what Postgres gave the
 * hand-written SQL, so the schema and the live database agree.
 */
export const skOrders = pgTable(
  "sk_orders",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    book_id: text("book_id").notNull(),
    title: text("title").notNull(),
    name: text("name"), // filled from Stripe on payment (0004)
    email: text("email"), // filled from Stripe on payment (0004)
    marketing_opt_in: boolean("marketing_opt_in").default(false).notNull(),
    amount_cents: integer("amount_cents").notNull(),
    currency: text("currency").default("usd").notNull(),
    /** pending | paid | refunded | disputed | expired */
    status: text("status").default("pending").notNull(),
    stripe_session_id: text("stripe_session_id").unique("sk_orders_stripe_session_id_key"),
    stripe_payment_intent: text("stripe_payment_intent"),
    token_hash: text("token_hash").unique("sk_orders_token_hash_key"),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    max_downloads: integer("max_downloads").default(10).notNull(),
    download_count: integer("download_count").default(0).notNull(),
    last_download_at: timestamp("last_download_at", { withTimezone: true }),
    email_sent_at: timestamp("email_sent_at", { withTimezone: true }),
    resend_requested_at: timestamp("resend_requested_at", { withTimezone: true }),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    paid_at: timestamp("paid_at", { withTimezone: true }),
    meta: jsonb("meta")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("sk_orders_email_idx").on(sql`lower(${t.email})`),
    index("sk_orders_status_idx").on(t.status),
    index("sk_orders_pi_idx").on(t.stripe_payment_intent),
  ],
).enableRLS();

export const skDownloadEvents = pgTable(
  "sk_download_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    order_id: uuid("order_id").notNull(),
    ip_hash: text("ip_hash"),
    user_agent: text("user_agent"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: "sk_download_events_order_id_fkey",
      columns: [t.order_id],
      foreignColumns: [skOrders.id],
    }).onDelete("cascade"),
    index("sk_download_events_order_idx").on(t.order_id),
  ],
).enableRLS();

/**
 * subscribers — the marketing list behind the email-capture popup.
 *
 * Deliberately NOT the `leads` table: the RefundAuto drip cron emails every
 * refundauto.com lead and every lead pings Slack. A popup signup must never
 * trigger either, so it lives here and nothing in the capture code reads or
 * writes `leads` (enforced by tests/capture.test.ts).
 *
 * One row per (site, email). A repeat signup updates the row and re-sends the
 * reward instead of creating a second row.
 */
export type SubscriberStatusT = "active" | "unsubscribed" | "bounced" | "complained";

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    site: varchar("site").notNull(),
    email: varchar("email").notNull(), // always lower-cased
    status: varchar("status").$type<SubscriberStatusT>().default("active").notNull(),
    /** False when an EU/UK/CA visitor left the opt-in box unticked: the reward
     *  is delivered, marketing is never sent. */
    marketing: boolean("marketing").default(true).notNull(),
    offer_id: varchar("offer_id"),
    variant: varchar("variant"),
    page: varchar("page"),
    device: varchar("device"),
    tz: varchar("tz"),
    country: varchar("country"),
    answers: jsonb("answers")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    utm: jsonb("utm")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    /** { text, euCheckbox, at, page } — the exact consent shown. */
    consent: jsonb("consent").notNull(),
    /** { value, expiresAt } — only ever used to write the reward email. */
    code: jsonb("code"),
    /** reward.product from the latest signup: what the follow-up emails sell
     *  (src/lib/capture/product.ts). Null when the site sent none. */
    context: jsonb("context"),
    /** Opaque random token for unsubscribe + the one-tap answer. */
    token: varchar("token").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    unsubscribed_at: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("subscribers_site_email_key").on(t.site, t.email),
    uniqueIndex("subscribers_token_key").on(t.token),
    index("subscribers_email_idx").on(t.email),
  ],
).enableRLS();

export type Subscriber = InferSelectModel<typeof subscribers>;
export type NewSubscriber = InferInsertModel<typeof subscribers>;

/** capture_stats_daily — popup counters; the source of truth for the A/B report. */
export const captureStatsDaily = pgTable(
  "capture_stats_daily",
  {
    site: varchar("site").notNull(),
    offer_id: varchar("offer_id").notNull(),
    device: varchar("device").notNull(),
    /** Calendar day in Pacific/Honolulu. */
    day: date("day").notNull(),
    views: integer("views").default(0).notNull(),
    closes: integer("closes").default(0).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    signups: integer("signups").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.site, t.offer_id, t.device, t.day] })],
).enableRLS();

/**
 * capture_sends — every follow-up / campaign email a subscriber has been sent,
 * one row per (subscriber, key). The row is written BEFORE the send (and
 * removed if the send fails), so two overlapping cron runs can never mail the
 * same step twice. Keys: `seq:<step>` (src/lib/capture/sequences.ts) and
 * `camp:<id>` (src/lib/capture/campaigns.ts). `email_id` is Resend's id, or
 * "skipped" when the step was deliberately not sent (e.g. they bought it).
 */
export const captureSends = pgTable(
  "capture_sends",
  {
    subscriber_id: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    key: varchar("key").notNull(),
    email_id: varchar("email_id"),
    sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriber_id, t.key] }), index("capture_sends_key_idx").on(t.key)],
).enableRLS();

/** capture_assign — the round-robin counter per (site, offer). */
export const captureAssign = pgTable(
  "capture_assign",
  {
    site: varchar("site").notNull(),
    offer_id: varchar("offer_id").notNull(),
    n: bigint("n", { mode: "number" }).default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.site, t.offer_id] })],
).enableRLS();
