-- ════════════════════════════════════════════════════════════════
--  UTRADE — патч для дропшиперів
--  Запустити в Supabase → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- 1. Додати поле TTN до замовлень
alter table public.orders add column if not exists ttn text;

-- 2. Авто-активація нових користувачів (без очікування адміна)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, status, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    'active',   -- одразу активний, не pending
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Список дозволених прайсів для кожного клієнта (null = нічого не дозволено)
alter table public.profiles add column if not exists allowed_exports text[] default null;

-- 4. Захист RLS: клієнт не може самостійно змінити allowed_exports через API
drop policy if exists "profile_self_update" on public.profiles;
create policy "profile_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role            = (select role            from public.profiles where id = auth.uid())
    and status          = (select status          from public.profiles where id = auth.uid())
    and allowed_exports is not distinct from
                          (select allowed_exports from public.profiles where id = auth.uid())
  );
