-- CostPilot V3: Gesamt-Monatsplan, Preiszeiträume und Live-Synchronisierung

alter table public.vendor_rates
  add column if not exists effective_from date not null default date '2000-01-01',
  add column if not exists effective_to date;

alter table public.vendor_rates
  drop constraint if exists vendor_rates_valid_period;
alter table public.vendor_rates
  add constraint vendor_rates_valid_period check (effective_to is null or effective_to >= effective_from);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null check(year between 2000 and 2200),
  month int not null check(month between 1 and 12),
  amount numeric(14,2) not null default 0 check(amount >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, year, month)
);

alter table public.monthly_budgets enable row level security;

drop policy if exists "own budgets all" on public.monthly_budgets;
create policy "own budgets all" on public.monthly_budgets
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger monthly_budgets_updated before update on public.monthly_budgets
for each row execute function public.set_updated_at();

-- Tabellen für Live-Synchronisierung freigeben, ohne Fehler bei erneutem Ausführen.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vendors') then alter publication supabase_realtime add table public.vendors; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vendor_rates') then alter publication supabase_realtime add table public.vendor_rates; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='time_entries') then alter publication supabase_realtime add table public.time_entries; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='monthly_budgets') then alter publication supabase_realtime add table public.monthly_budgets; end if;
end $$;
