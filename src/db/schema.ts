import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  uuid,
  text,
  index,
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
