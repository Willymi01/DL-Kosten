-- CostPilot Single-User: ein Konto, eine Firma, sichere Cloud-Daten
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  rate_id uuid not null references public.vendor_rates(id) on delete cascade,
  work_date date not null,
  hours numeric(8,2) not null default 0 check (hours >= 0 and hours <= 24),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, vendor_id, rate_id, work_date)
);

create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  year int not null check(year between 2000 and 2200),
  month int not null check(month between 1 and 12),
  amount numeric(14,2) not null default 0 check(amount >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, vendor_id, year, month)
);

create index vendors_user_idx on public.vendors(user_id);
create index rates_user_vendor_idx on public.vendor_rates(user_id, vendor_id);
create index entries_user_date_idx on public.time_entries(user_id, work_date);
create index plans_user_period_idx on public.monthly_plans(user_id, year, month);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_rates enable row level security;
alter table public.time_entries enable row level security;
alter table public.monthly_plans enable row level security;

create policy "own profile read" on public.profiles
for select to authenticated using ((select auth.uid()) = id);

create policy "own profile update" on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "own vendors all" on public.vendors
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "own rates all" on public.vendor_rates
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "own entries all" on public.time_entries
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "own plans all" on public.monthly_plans
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger vendors_updated before update on public.vendors
for each row execute function public.set_updated_at();
create trigger rates_updated before update on public.vendor_rates
for each row execute function public.set_updated_at();
create trigger entries_updated before update on public.time_entries
for each row execute function public.set_updated_at();
create trigger plans_updated before update on public.monthly_plans
for each row execute function public.set_updated_at();
