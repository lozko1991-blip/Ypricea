-- ════════════════════════════════════════════════════════════════
--  UTRADE SaaS — Supabase user_feeds table schema & migrations
--  Run this script in your Supabase SQL Editor to fix the schema cache error
-- ════════════════════════════════════════════════════════════════

-- 1. Create the user_feeds table if it does not exist
create table if not exists public.user_feeds (
  id               uuid        not null default gen_random_uuid() primary key,
  user_id          uuid        references auth.users on delete cascade,
  name             text        not null,
  token            text        not null unique,
  format           text        not null default 'prom',
  suppliers        jsonb       not null default '[]'::jsonb,
  rules            jsonb       not null default '[]'::jsonb,
  category_mapping jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2. Add columns if table exists but they are missing (migration guard)
alter table public.user_feeds add column if not exists format text not null default 'prom';
alter table public.user_feeds add column if not exists category_mapping jsonb not null default '{}'::jsonb;

-- 3. Enable Row Level Security (RLS)
alter table public.user_feeds enable row level security;

-- 4. Recreate security policies to restrict access strictly to the owner
drop policy if exists "Allow select to owner" on public.user_feeds;
drop policy if exists "Allow insert to owner" on public.user_feeds;
drop policy if exists "Allow update to owner" on public.user_feeds;
drop policy if exists "Allow delete to owner" on public.user_feeds;

create policy "Allow select to owner" on public.user_feeds
  for select using (auth.uid() = user_id);

create policy "Allow insert to owner" on public.user_feeds
  for insert with check (auth.uid() = user_id);

create policy "Allow update to owner" on public.user_feeds
  for update using (auth.uid() = user_id);

create policy "Allow delete to owner" on public.user_feeds
  for delete using (auth.uid() = user_id);
