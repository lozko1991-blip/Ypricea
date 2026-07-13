-- ════════════════════════════════════════════════════════════════
--  UTRADE SaaS — Complete Supabase Database Setup & Migrations
--  Run this script ONCE in your Supabase SQL Editor (it is safe and idempotent)
-- ════════════════════════════════════════════════════════════════

-- ── 1. PROFILES (Users and Subscriptions) ────────────────────────
create table if not exists public.profiles (
  id                       uuid          not null references auth.users on delete cascade primary key,
  name                     text,
  store_name               text,
  phone                    text,
  status                   text          not null default 'pending' check (status in ('pending','active','blocked')),
  role                     text          not null default 'user' check (role in ('user','admin')),
  markup_pct               numeric(5,2)  default 20,
  markup_grn               numeric(8,2)  default 0,
  notes                    text,
  allowed_exports          text[]        default null,
  balance                  numeric(10,2) not null default 0.00,
  subscription_plan        text          not null default 'trial',
  subscription_status      text          not null default 'active',
  subscription_expires_at  timestamptz,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz   not null default now()
);

-- Safe migrations guard for profiles (if table already existed)
alter table public.profiles add column if not exists balance numeric(10,2) not null default 0.00;
alter table public.profiles add column if not exists subscription_plan text not null default 'trial';
alter table public.profiles add column if not exists subscription_status text not null default 'active';
alter table public.profiles add column if not exists subscription_expires_at timestamptz;

-- ── 2. ORDERS (Drop Shipping Orders) ──────────────────────────────
create table if not exists public.orders (
  id            bigint        generated always as identity primary key,
  user_id       uuid          references auth.users on delete set null,
  client_name   text,
  client_phone  text,
  client_city   text,
  payment_type  text,
  comment       text,
  items         jsonb         not null default '[]'::jsonb,
  total_sell    numeric(10,2) default 0,
  total_drop    numeric(10,2) default 0,
  status        text          not null default 'new' check (status in ('new','processing','shipped','done','cancelled')),
  admin_notes   text,
  droper_code   text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- ── 3. USER FEEDS (Catalog Constructors Configs) ─────────────────
create table if not exists public.user_feeds (
  id                    uuid        not null default gen_random_uuid() primary key,
  user_id               uuid        references auth.users on delete cascade,
  name                  text        not null,
  token                 text        not null unique,
  format                text        not null default 'prom',
  suppliers             jsonb       not null default '[]'::jsonb,
  rules                 jsonb       not null default '[]'::jsonb,
  category_mapping      jsonb       not null default '{}'::jsonb,
  emergency_stock_zero  boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Safe migrations guard for user_feeds (if table already existed)
alter table public.user_feeds add column if not exists format text not null default 'prom';
alter table public.user_feeds add column if not exists category_mapping jsonb not null default '{}'::jsonb;
alter table public.user_feeds add column if not exists emergency_stock_zero boolean not null default false;

-- ── 4. SYNC LOGS (Automated Cron Runs Monitor) ───────────────────
create table if not exists public.sync_logs (
  id             uuid          not null default gen_random_uuid() primary key,
  started_at     timestamptz   not null default now(),
  supplier_name  text          not null,
  user_email     text          not null,
  status         text          not null check (status in ('success', 'failed', 'syncing')),
  imported_count integer       not null default 0,
  message        text
);

-- ── 5. SETTINGS (Global Configuration Store) ─────────────────────
create table if not exists public.settings (
  key         text        not null primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- ── 6. MARKETPLACE CATEGORIES (Prom/Rozetka Leaf Categories) ──────
create table if not exists public.marketplace_categories (
  id           text        not null,
  name         text        not null,
  marketplace  text        not null,
  parent_id    text,
  primary key (id, marketplace)
);

-- ── 7. TRANSLATION CACHE (Auto Translation Cache) ────────────────
create table if not exists public.translation_cache (
  hash        text        not null primary key,
  ru_text     text        not null,
  uk_text     text        not null,
  created_at  timestamptz not null default now()
);

-- ── 8. DATABASE FUNCTIONS & TRIGGER SETUPS ────────────────────────

-- Helper function to check if the current user is an admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Trigger: auto-create profiles row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, status, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    'pending',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: auto updated_at timestamp updates
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

drop trigger if exists user_feeds_updated_at on public.user_feeds;
create trigger user_feeds_updated_at
  before update on public.user_feeds
  for each row execute procedure public.set_updated_at();


-- ── 9. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES ───────────────

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.user_feeds enable row level security;
alter table public.sync_logs enable row level security;
alter table public.settings enable row level security;
alter table public.marketplace_categories enable row level security;
alter table public.translation_cache enable row level security;

-- PROFILES
drop policy if exists "profile_self_select" on public.profiles;
drop policy if exists "profile_self_update" on public.profiles;
drop policy if exists "profile_admin_select" on public.profiles;
drop policy if exists "profile_admin_update" on public.profiles;

create policy "profile_self_select" on public.profiles for select using (auth.uid() = id);
create policy "profile_self_update" on public.profiles for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role            = (select role            from public.profiles where id = auth.uid())
    and status          = (select status          from public.profiles where id = auth.uid())
    and allowed_exports is not distinct from (select allowed_exports from public.profiles where id = auth.uid())
  );
create policy "profile_admin_select" on public.profiles for select using (is_admin());
create policy "profile_admin_update" on public.profiles for update using (is_admin());

-- ORDERS
drop policy if exists "orders_self_select" on public.orders;
drop policy if exists "orders_self_insert" on public.orders;
drop policy if exists "orders_admin_select" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;

create policy "orders_self_select" on public.orders for select using (auth.uid() = user_id);
create policy "orders_self_insert" on public.orders for insert with check (auth.uid() = user_id);
create policy "orders_admin_select" on public.orders for select using (is_admin());
create policy "orders_admin_update" on public.orders for update using (is_admin());

-- USER FEEDS
drop policy if exists "Allow select to owner" on public.user_feeds;
drop policy if exists "Allow insert to owner" on public.user_feeds;
drop policy if exists "Allow update to owner" on public.user_feeds;
drop policy if exists "Allow delete to owner" on public.user_feeds;

create policy "Allow select to owner" on public.user_feeds for select using (auth.uid() = user_id);
create policy "Allow insert to owner" on public.user_feeds for insert with check (auth.uid() = user_id);
create policy "Allow update to owner" on public.user_feeds for update using (auth.uid() = user_id);
create policy "Allow delete to owner" on public.user_feeds for delete using (auth.uid() = user_id);

-- SYNC LOGS
drop policy if exists "Allow read sync_logs to authenticated" on public.sync_logs;
drop policy if exists "Allow write sync_logs to admins" on public.sync_logs;

create policy "Allow read sync_logs to authenticated" on public.sync_logs for select using (auth.role() = 'authenticated');
create policy "Allow write sync_logs to admins" on public.sync_logs for all using (public.is_admin());

-- SETTINGS
drop policy if exists "Allow read settings to authenticated" on public.settings;
drop policy if exists "Allow write settings to admins" on public.settings;

create policy "Allow read settings to authenticated" on public.settings for select using (auth.role() = 'authenticated');
create policy "Allow write settings to admins" on public.settings for all using (public.is_admin());

-- MARKETPLACE CATEGORIES
drop policy if exists "Allow read marketplace_categories to authenticated" on public.marketplace_categories;
drop policy if exists "Allow write marketplace_categories to admins" on public.marketplace_categories;

create policy "Allow read marketplace_categories to authenticated" on public.marketplace_categories for select using (auth.role() = 'authenticated');
create policy "Allow write marketplace_categories to admins" on public.marketplace_categories for all using (public.is_admin());

-- TRANSLATION CACHE
drop policy if exists "Allow read translation_cache to all" on public.translation_cache;
drop policy if exists "Allow insert translation_cache to all" on public.translation_cache;

create policy "Allow read translation_cache to all" on public.translation_cache for select using (true);
create policy "Allow insert translation_cache to all" on public.translation_cache for insert with check (true);
