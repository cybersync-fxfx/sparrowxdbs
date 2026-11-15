-- SparrowX Game Hosting — client portal schema (PostgreSQL 14+), exposed through PostgREST.
-- Run once against your database, then grant the PostgREST role used by POSTGREST_API_KEY (see bottom).

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id                  uuid primary key default gen_random_uuid(),
  discord_id          text not null unique,
  discord_username    text not null,
  discord_avatar      text,
  email               text,
  ptero_user_id       integer unique,
  ptero_username      text,
  ptero_password_enc  text,                 -- AES-GCM ciphertext, never plaintext
  coins               integer not null default 0 check (coins >= 0),
  created_at          timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  ptero_server_id  integer,
  service_type     text not null check (service_type in ('fivem','samp','minecraft','discord')),
  plan_name        text not null,
  price_coins      integer not null check (price_coins > 0),
  status           text not null default 'active' check (status in ('active','expired','cancelled')),
  expires_at       timestamptz not null default (now() + interval '30 days'),
  created_at       timestamptz not null default now()
);
create index if not exists subscriptions_client_idx on public.subscriptions(client_id);
create index if not exists subscriptions_expiry_idx on public.subscriptions(expires_at) where status = 'active';

create table if not exists public.coin_transactions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  amount       integer not null,            -- positive = credit, negative = debit
  type         text not null check (type in ('topup','promo','purchase','refund','bonus')),
  description  text not null,
  reference    text unique,                 -- idempotency key (razorpay:<payment_id>, promo:<code>:<client>)
  created_at   timestamptz not null default now()
);
create index if not exists coin_tx_client_idx on public.coin_transactions(client_id, created_at desc);

create table if not exists public.promo_codes (
  code        text primary key,
  coins       integer not null check (coins > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Atomic debit: raises 'insufficient_coins' when the balance is too low.
create or replace function public.spend_coins(p_client_id uuid, p_amount integer, p_description text)
returns integer language plpgsql as $$
declare new_balance integer;
begin
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;
  update public.clients set coins = coins - p_amount
   where id = p_client_id and coins >= p_amount
   returning coins into new_balance;
  if new_balance is null then raise exception 'insufficient_coins'; end if;
  insert into public.coin_transactions (client_id, amount, type, description)
  values (p_client_id, -p_amount, 'purchase', p_description);
  return new_balance;
end $$;

-- Idempotent credit: a reference that already exists is skipped (applied = false).
create or replace function public.credit_coins(
  p_client_id uuid, p_amount integer, p_type text, p_description text, p_reference text
) returns table (balance integer, applied boolean) language plpgsql as $$
declare inserted boolean := false;
begin
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into public.coin_transactions (client_id, amount, type, description, reference)
  values (p_client_id, p_amount, p_type, p_description, p_reference)
  on conflict (reference) do nothing
  returning true into inserted;
  if coalesce(inserted, false) then
    update public.clients set coins = coins + p_amount where id = p_client_id;
  end if;
  return query select c.coins, coalesce(inserted, false) from public.clients c where c.id = p_client_id;
end $$;

-- PostgREST access: the server signs requests with a JWT for this role (POSTGREST_API_KEY).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'sparrowx_service') then
    create role sparrowx_service nologin;
  end if;
end $$;
grant usage on schema public to sparrowx_service;
grant select, insert, update on public.clients, public.subscriptions, public.coin_transactions to sparrowx_service;
grant select on public.promo_codes to sparrowx_service;
grant execute on function public.spend_coins(uuid, integer, text) to sparrowx_service;
grant execute on function public.credit_coins(uuid, integer, text, text, text) to sparrowx_service;

-- Example promo code:
-- insert into public.promo_codes (code, coins) values ('SPARROW100', 100) on conflict do nothing;
