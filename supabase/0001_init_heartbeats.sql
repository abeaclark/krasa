-- Heartbeats — keep-alive ping log.
--
-- Supabase pauses free-tier projects that go too long without DB activity.
-- A Vercel cron hits /api/cron/heartbeat daily and inserts one row here, which
-- keeps the project active. The table also serves as a simple uptime log.
--
-- Apply via:
--   1. `npm run db:push`  (drizzle-kit diffs src/db/schema.ts against the DB)
--   2. Paste this file into the Supabase SQL editor and run it.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists "heartbeats" (
  "id"         uuid primary key default gen_random_uuid(),
  "source"     varchar not null default 'vercel-cron',
  "meta"       jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create index if not exists "heartbeats_created_at_idx" on "heartbeats" ("created_at");
