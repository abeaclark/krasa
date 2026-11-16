-- Email-capture popup: subscriber list, daily counters, round-robin counter.
--
-- Separate from `leads` on purpose: the RefundAuto drip cron emails every
-- refundauto.com lead and every lead pings Slack. Popup signups do neither.
--
-- Only this server talks to these tables (postgres connection / service role);
-- RLS is ON with no policies, so the anon key can read nothing.
--
-- Superseded by src/db/migrations/0001_email_capture.sql: apply with
-- `pnpm db:migrate`. Kept as history. If this file was already run by hand,
-- `pnpm db:baseline --apply` records 0001 as applied too.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists "subscribers" (
  "id"              uuid primary key default gen_random_uuid(),
  "site"            varchar not null,
  "email"           varchar not null,              -- lower-cased
  "status"          varchar not null default 'active',  -- active | unsubscribed | bounced | complained
  "marketing"       boolean not null default true,
  "offer_id"        varchar,
  "variant"         varchar,
  "page"            varchar,
  "device"          varchar,
  "tz"              varchar,
  "country"         varchar,
  "answers"         jsonb not null default '{}'::jsonb,
  "utm"             jsonb not null default '{}'::jsonb,
  "consent"         jsonb not null,                -- { text, euCheckbox, at, page }
  "code"            jsonb,                         -- { value, expiresAt }
  "token"           varchar not null,
  "created_at"      timestamptz not null default now(),
  "updated_at"      timestamptz not null default now(),
  "unsubscribed_at" timestamptz
);

create unique index if not exists "subscribers_site_email_key" on "subscribers" ("site", "email");
create unique index if not exists "subscribers_token_key" on "subscribers" ("token");
create index if not exists "subscribers_email_idx" on "subscribers" ("email");

create table if not exists "capture_stats_daily" (
  "site"     varchar not null,
  "offer_id" varchar not null,
  "device"   varchar not null,
  "day"      date not null,                        -- Pacific/Honolulu calendar day
  "views"    integer not null default 0,
  "closes"   integer not null default 0,
  "clicks"   integer not null default 0,
  "signups"  integer not null default 0,
  primary key ("site", "offer_id", "device", "day")
);

create table if not exists "capture_assign" (
  "site"     varchar not null,
  "offer_id" varchar not null,
  "n"        bigint not null default 0,
  primary key ("site", "offer_id")
);

alter table "subscribers" enable row level security;
alter table "capture_stats_daily" enable row level security;
alter table "capture_assign" enable row level security;
