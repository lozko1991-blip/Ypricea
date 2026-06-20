-- ════════════════════════════════════════════════════════════════
--  UTRADE SaaS — Supabase schema (idempotent, можна запускати повторно)
-- ════════════════════════════════════════════════════════════════

-- ── 1. PROFILES ──────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid        not null references auth.users on delete cascade primary key,
  name        text,
  store_name  text,
  phone       text,
  status      text        not null default 'pending'
                          check (status in ('pending','active','blocked')),
  role        text        not null default 'user'
                          check (role   in ('user','admin')),
  markup_pct      numeric(5,2) default 20,
  markup_grn      numeric(8,2) default 0,
  notes           text,
  allowed_exports text[]       default null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 2. ORDERS ─────────────────────────────────────────────────────
create table if not exists public.orders (
  id            bigint      generated always as identity primary key,
  user_id       uuid        references auth.users on delete set null,
  client_name   text,
  client_phone  text,
  client_city   text,
  payment_type  text,
  comment       text,
  items         jsonb       not null default '[]',
  total_sell    numeric(10,2) default 0,
  total_drop    numeric(10,2) default 0,
  status        text        not null default 'new'
                check (status in ('new','processing','shipped','done','cancelled')),
  admin_notes   text,
  droper_code   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 3. Helper is_admin() ──────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ── 4. RLS ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;

-- Дропаємо старі, щоб не було конфліктів
drop policy if exists "profile_self_select"  on public.profiles;
drop policy if exists "profile_self_update"  on public.profiles;
drop policy if exists "profile_admin_select" on public.profiles;
drop policy if exists "profile_admin_update" on public.profiles;
drop policy if exists "orders_self_select"   on public.orders;
drop policy if exists "orders_self_insert"   on public.orders;
drop policy if exists "orders_admin_select"  on public.orders;
drop policy if exists "orders_admin_update"  on public.orders;

-- profiles
create policy "profile_self_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profile_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role            = (select role            from public.profiles where id = auth.uid())
    and status          = (select status          from public.profiles where id = auth.uid())
    and allowed_exports is not distinct from
                          (select allowed_exports from public.profiles where id = auth.uid())
  );

create policy "profile_admin_select" on public.profiles
  for select using (is_admin());

create policy "profile_admin_update" on public.profiles
  for update using (is_admin());

-- orders
create policy "orders_self_select" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_self_insert" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_admin_select" on public.orders
  for select using (is_admin());

create policy "orders_admin_update" on public.orders
  for update using (is_admin());

-- ── 5. Тригер: автопрофіль при реєстрації ─────────────────────────
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

-- ── 6. Auto updated_at ────────────────────────────────────────────
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
