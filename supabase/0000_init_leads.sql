-- Global leads backend — initial schema.
--
-- Two ways to apply this:
--   1. `npm run db:push`  (drizzle-kit diffs src/db/schema.ts against the DB)
--   2. Paste this file into the Supabase SQL editor and run it.
--
-- This DDL is kept in sync with src/db/schema.ts by hand for the SQL-editor
-- path; drizzle-kit remains the source of truth via db:push / db:generate.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists "leads" (
  "id"         uuid primary key default gen_random_uuid(),
  "site"       varchar not null,
  "source"     varchar,
  "status"     varchar not null default 'new',
  "name"       varchar,
  "email"      varchar,
  "phone"      varchar,
  "message"    text,
  "meta"       jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "leads_site_idx"       on "leads" ("site");
create index if not exists "leads_status_idx"     on "leads" ("status");
create index if not exists "leads_created_at_idx" on "leads" ("created_at");
create index if not exists "leads_email_idx"      on "leads" ("email");

-- Keep updated_at fresh on status changes / edits.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on "leads";
create trigger leads_set_updated_at
  before update on "leads"
  for each row execute function set_updated_at();
