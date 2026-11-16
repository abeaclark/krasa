-- BASELINE — never run this file against the live database.
-- It describes the tables that already existed when Krasa moved to drizzle
-- migrations (Nov 16, 2026; made by supabase/0000–0004 in the SQL editor).
-- `pnpm db:baseline --apply` records it in drizzle.__drizzle_migrations as
-- applied, once, so `pnpm db:migrate` starts with 0001.
CREATE TABLE "heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar DEFAULT 'vercel-cron' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site" varchar NOT NULL,
	"source" varchar,
	"status" varchar DEFAULT 'new' NOT NULL,
	"name" varchar,
	"email" varchar,
	"phone" varchar,
	"message" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sk_download_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sk_download_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sk_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" text NOT NULL,
	"title" text NOT NULL,
	"name" text,
	"email" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"max_downloads" integer DEFAULT 10 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_download_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"resend_requested_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sk_orders_stripe_session_id_key" UNIQUE("stripe_session_id"),
	CONSTRAINT "sk_orders_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "sk_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sk_download_events" ADD CONSTRAINT "sk_download_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sk_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heartbeats_created_at_idx" ON "heartbeats" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_site_idx" ON "leads" USING btree ("site");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sk_download_events_order_idx" ON "sk_download_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sk_orders_email_idx" ON "sk_orders" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "sk_orders_status_idx" ON "sk_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sk_orders_pi_idx" ON "sk_orders" USING btree ("stripe_payment_intent");