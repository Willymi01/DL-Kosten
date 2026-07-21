-- CostPilot V14: Admin-verwaltete Teamzugänge und gemeinsamer Datenbestand

alter table public.profiles
  add column if not exists account_id uuid,
  add column if not exists role text not null default 'member',
  add column if not exists active boolean not null default true,
  add column if not exists email text not null default '';

update public.profiles
set account_id = id,
    role = 'admin'
where account_id is null;

alter table public.profiles alter column account_id set not null;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'member'));
create index if not exists profiles_account_idx on public.profiles(account_id);

create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select account_id from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' and active from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account uuid;
  requested_role text;
begin
  requested_account := nullif(new.raw_user_meta_data ->> 'account_id', '')::uuid;
  requested_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'admin');

  insert into public.profiles(id, account_id, role, active, email, full_name)
  values (
    new.id,
    coalesce(requested_account, new.id),
    case when requested_role in ('admin', 'member') then requested_role else 'member' end,
    true,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;
  return new;
end;
$$;

alter table public.vendors alter column user_id set default public.current_account_id();
alter table public.vendor_rates alter column user_id set default public.current_account_id();
alter table public.time_entries alter column user_id set default public.current_account_id();
alter table public.monthly_plans alter column user_id set default public.current_account_id();
alter table public.monthly_budgets alter column user_id set default public.current_account_id();

-- Der bisherige Stundencheck war für summierte Dienstleisterstunden zu eng.
alter table public.time_entries drop constraint if exists time_entries_hours_check;
alter table public.time_entries add constraint time_entries_hours_check check (hours >= 0 and hours <= 1000);

-- Profile: Teammitglieder sehen ihr Team; nur Admins dürfen Profile ändern.
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "team profiles read" on public.profiles;
drop policy if exists "admin profiles update" on public.profiles;
create policy "team profiles read" on public.profiles
for select to authenticated
using (account_id = public.current_account_id());
create policy "admin profiles update" on public.profiles
for update to authenticated
using (account_id = public.current_account_id() and public.current_user_is_admin())
with check (account_id = public.current_account_id() and public.current_user_is_admin());

-- Gemeinsame Firmendaten innerhalb eines Accounts.
drop policy if exists "own vendors all" on public.vendors;
drop policy if exists "team vendors all" on public.vendors;
create policy "team vendors all" on public.vendors for all to authenticated
using (user_id = public.current_account_id())
with check (user_id = public.current_account_id());

drop policy if exists "own rates all" on public.vendor_rates;
drop policy if exists "team rates all" on public.vendor_rates;
create policy "team rates all" on public.vendor_rates for all to authenticated
using (user_id = public.current_account_id())
with check (user_id = public.current_account_id());

drop policy if exists "own entries all" on public.time_entries;
drop policy if exists "team entries all" on public.time_entries;
create policy "team entries all" on public.time_entries for all to authenticated
using (user_id = public.current_account_id())
with check (user_id = public.current_account_id());

drop policy if exists "own plans all" on public.monthly_plans;
drop policy if exists "team plans all" on public.monthly_plans;
create policy "team plans all" on public.monthly_plans for all to authenticated
using (user_id = public.current_account_id())
with check (user_id = public.current_account_id());

drop policy if exists "own budgets all" on public.monthly_budgets;
drop policy if exists "team budgets all" on public.monthly_budgets;
create policy "team budgets all" on public.monthly_budgets for all to authenticated
using (user_id = public.current_account_id())
with check (user_id = public.current_account_id());
