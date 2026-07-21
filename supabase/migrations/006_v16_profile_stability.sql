-- CostPilot V16: stabile Profil- und Admin-Grundlage
-- Kann gefahrlos mehrfach ausgeführt werden.

insert into public.profiles (id, full_name, account_id, role, active, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.id,
  'admin',
  true,
  coalesce(u.email, '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

create index if not exists profiles_account_active_idx
  on public.profiles(account_id, active);

create index if not exists profiles_email_lower_idx
  on public.profiles(lower(email));

-- Aktive Benutzer müssen ihr eigenes Profil immer lesen können.
drop policy if exists "own profile read v16" on public.profiles;
create policy "own profile read v16"
on public.profiles
for select
to authenticated
using (id = auth.uid());
