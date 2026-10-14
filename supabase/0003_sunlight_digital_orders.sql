-- Sunlight Kids — Download & Print orders (sunlightkids.com).
--
-- Lives in the shared krasa Supabase project (free plan). Only sunlightkids.com's
-- server talks to these tables, with the service-role key; RLS is ON with no
-- policies, so the anon/public key can read or write nothing.
--
-- One row per purchase. The buyer's download link is
--   https://www.sunlightkids.com/download/<token>
-- where token = HMAC(DOWNLOAD_TOKEN_SECRET, order id). Only its SHA-256 is stored
-- here (token_hash), so a database leak doesn't leak working links.

create extension if not exists "pgcrypto";

create table if not exists sk_orders (
  id                    uuid primary key default gen_random_uuid(),
  book_id               text not null,
  title                 text not null,
  name                  text not null,
  email                 text not null,
  marketing_opt_in      boolean not null default false,
  amount_cents          integer not null,
  currency              text not null default 'usd',
  status                text not null default 'pending',  -- pending | paid | refunded | disputed | expired
  stripe_session_id     text unique,
  stripe_payment_intent text,
  token_hash            text unique,
  expires_at            timestamptz,
  max_downloads         integer not null default 10,
  download_count        integer not null default 0,
  last_download_at      timestamptz,
  email_sent_at         timestamptz,
  resend_requested_at   timestamptz,
  revoked_at            timestamptz,
  paid_at               timestamptz,
  meta                  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sk_orders_email_idx  on sk_orders (lower(email));
create index if not exists sk_orders_status_idx on sk_orders (status);
create index if not exists sk_orders_pi_idx     on sk_orders (stripe_payment_intent);

create table if not exists sk_download_events (
  id         bigserial primary key,
  order_id   uuid not null references sk_orders(id) on delete cascade,
  ip_hash    text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists sk_download_events_order_idx on sk_download_events (order_id);

-- updated_at trigger (set_updated_at() already exists from 0000_init_leads.sql;
-- recreate defensively so this file also runs on its own).
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists sk_orders_set_updated_at on sk_orders;
create trigger sk_orders_set_updated_at before update on sk_orders
  for each row execute function set_updated_at();

alter table sk_orders enable row level security;
alter table sk_download_events enable row level security;

-- Atomically spend one download: only succeeds while the order is paid, not
-- revoked, not expired and under its download cap. Returns the order row on
-- success, nothing otherwise.
create or replace function sk_claim_download(p_token_hash text, p_ip_hash text, p_user_agent text)
returns setof sk_orders
language plpgsql
security definer
set search_path = public
as $$
declare r sk_orders;
begin
  update sk_orders
     set download_count = download_count + 1,
         last_download_at = now()
   where token_hash = p_token_hash
     and status = 'paid'
     and revoked_at is null
     and expires_at > now()
     and download_count < max_downloads
  returning * into r;
  if found then
    insert into sk_download_events (order_id, ip_hash, user_agent)
    values (r.id, p_ip_hash, left(p_user_agent, 300));
    return next r;
  end if;
end;
$$;

revoke all on function sk_claim_download(text, text, text) from public, anon, authenticated;

grant execute on function sk_claim_download(text, text, text) to service_role;
grant select, insert, update, delete on table sk_orders, sk_download_events to service_role;
grant usage, select on sequence sk_download_events_id_seq to service_role;
