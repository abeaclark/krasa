CREATE TABLE "capture_assign" (
	"site" varchar NOT NULL,
	"offer_id" varchar NOT NULL,
	"n" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "capture_assign_site_offer_id_pk" PRIMARY KEY("site","offer_id")
);
--> statement-breakpoint
ALTER TABLE "capture_assign" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capture_stats_daily" (
	"site" varchar NOT NULL,
	"offer_id" varchar NOT NULL,
	"device" varchar NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"closes" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"signups" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capture_stats_daily_site_offer_id_device_day_pk" PRIMARY KEY("site","offer_id","device","day")
);
--> statement-breakpoint
ALTER TABLE "capture_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site" varchar NOT NULL,
	"email" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"marketing" boolean DEFAULT true NOT NULL,
	"offer_id" varchar,
	"variant" varchar,
	"page" varchar,
	"device" varchar,
	"tz" varchar,
	"country" varchar,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent" jsonb NOT NULL,
	"code" jsonb,
	"token" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_site_email_key" ON "subscribers" USING btree ("site","email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_token_key" ON "subscribers" USING btree ("token");--> statement-breakpoint
CREATE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");