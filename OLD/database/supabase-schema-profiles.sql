-- ════════════════════════════════════════════════════════════════
--  UTRADE SaaS — Supabase profiles billing & subscriptions migration
--  Run this script in your Supabase SQL Editor to fix the schema cache error
-- ════════════════════════════════════════════════════════════════

-- 1. Add subscription and billing columns to profiles table if they are missing
alter table public.profiles add column if not exists balance numeric(10,2) not null default 0.00;
alter table public.profiles add column if not exists subscription_plan text not null default 'trial';
alter table public.profiles add column if not exists subscription_status text not null default 'active';
alter table public.profiles add column if not exists subscription_expires_at timestamptz;
