-- ════════════════════════════════════════════════════════════════
--  UTRADE SaaS — Supabase schema addons (Run in Supabase SQL Editor)
-- ════════════════════════════════════════════════════════════════

-- ── 1. SETTINGS ──────────────────────────────────────────────────
create table if not exists public.settings (
  key         text        not null primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- ── 2. SYNC LOGS ──────────────────────────────────────────────────
create table if not exists public.sync_logs (
  id             uuid          not null default gen_random_uuid() primary key,
  started_at     timestamptz   not null default now(),
  supplier_name  text          not null,
  user_email     text          not null,
  status         text          not null check (status in ('success', 'failed', 'syncing')),
  imported_count integer       not null default 0,
  message        text
);

-- ── 3. MARKETPLACE CATEGORIES ──────────────────────────────────────
create table if not exists public.marketplace_categories (
  id           text        not null,
  name         text        not null,
  marketplace  text        not null,
  parent_id    text,
  primary key (id, marketplace)
);

-- ── 4. ROW LEVEL SECURITY (RLS) ───────────────────────────────────
alter table public.settings enable row level security;
alter table public.sync_logs enable row level security;
alter table public.marketplace_categories enable row level security;

-- Drop existing policies if any
drop policy if exists "Allow read settings to authenticated" on public.settings;
drop policy if exists "Allow write settings to admins" on public.settings;
drop policy if exists "Allow read sync_logs to authenticated" on public.sync_logs;
drop policy if exists "Allow write sync_logs to admins" on public.sync_logs;
drop policy if exists "Allow read marketplace_categories to authenticated" on public.marketplace_categories;
drop policy if exists "Allow write marketplace_categories to admins" on public.marketplace_categories;
drop policy if exists "Allow all to anonymous for setup" on public.marketplace_categories;

-- Policies for SETTINGS
create policy "Allow read settings to authenticated" 
  on public.settings for select 
  using (auth.role() = 'authenticated');

create policy "Allow write settings to admins" 
  on public.settings for all 
  using (public.is_admin());

-- Policies for SYNC LOGS
create policy "Allow read sync_logs to authenticated" 
  on public.sync_logs for select 
  using (auth.role() = 'authenticated');

create policy "Allow write sync_logs to admins" 
  on public.sync_logs for all 
  using (public.is_admin());

-- Policies for MARKETPLACE CATEGORIES
create policy "Allow read marketplace_categories to authenticated" 
  on public.marketplace_categories for select 
  using (auth.role() = 'authenticated');

create policy "Allow write marketplace_categories to admins" 
  on public.marketplace_categories for all 
  using (public.is_admin());
