-- CostPilot V15.1: direkte, admin-verwaltete Benutzerkonten
-- Voraussetzung: Die Edge Function admin-users legt Auth-Konten mit dem
-- Service-Role-Schlüssel an. Öffentliche Registrierung bleibt deaktiviert.

-- Bestehende Auth-Benutzer zuverlässig als Administratoren nachtragen.
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

-- Neue Benutzer werden ausschließlich durch die Admin-Edge-Function erstellt.
-- Sie übermittelt account_id, role und full_name in den User-Metadaten.
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
    full_name = excluded.full_name,
    account_id = excluded.account_id,
    role = excluded.role,
    active = true;
  return new;
end;
$$;

-- Das Sperren erfolgt über profiles.active; RLS und current_account_id()
-- schließen gesperrte Nutzer automatisch vom gemeinsamen Datenbestand aus.
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select account_id from public.profiles where id = auth.uid() and active = true
$$;

-- Einladungs-RPCs aus V15 werden nicht mehr benötigt.
revoke execute on function public.create_team_invite(text, text) from authenticated;
revoke execute on function public.list_team_invites() from authenticated;
revoke execute on function public.revoke_team_invite(uuid) from authenticated;
