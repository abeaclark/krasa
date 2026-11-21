CREATE TABLE "capture_sends" (
	"subscriber_id" uuid NOT NULL,
	"key" varchar NOT NULL,
	"email_id" varchar,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_sends_subscriber_id_key_pk" PRIMARY KEY("subscriber_id","key")
);
--> statement-breakpoint
ALTER TABLE "capture_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "capture_sends" ADD CONSTRAINT "capture_sends_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_sends_key_idx" ON "capture_sends" USING btree ("key");