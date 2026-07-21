-- CostPilot V15: stabile Benutzerverwaltung ohne Edge Function
-- Admins erstellen Einladungen. Neue Benutzer registrieren sich ausschließlich
-- mit einem gültigen, einmaligen Token. Nicht eingeladene Registrierungen werden
-- durch den Auth-Trigger abgewiesen.

create extension if not exists pgcrypto;

-- Bestehende Auth-Benutzer nachtragen. Jeder bisherige Einzelbenutzer bleibt
-- Administrator seines bisherigen Datenbestands.
insert into public.profiles (id, full_name, account_id, role, active, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.id,
  'admin',
  true,
  coalesce(u.email, '')
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  account_id = coalesce(public.profiles.account_id, excluded.account_id),
  active = true;

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  email text not null,
  full_name text not null default '',
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists team_invites_account_idx on public.team_invites(account_id, created_at desc);
create index if not exists team_invites_email_idx on public.team_invites(lower(email));
alter table public.team_invites enable row level security;

-- Direkter Tabellenzugriff ist nicht erforderlich. Alle Änderungen laufen über
-- die folgenden Security-Definer-Funktionen.
revoke all on public.team_invites from anon, authenticated;

create or replace function public.create_team_invite(
  p_email text,
  p_full_name text default ''
)
returns table(invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account uuid;
  v_token text;
  v_expiry timestamptz := now() + interval '7 days';
begin
  if not public.current_user_is_admin() then
    raise exception 'Nur Administratoren dürfen Einladungen erstellen.';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'Bitte eine E-Mail-Adresse angeben.';
  end if;

  v_account := public.current_account_id();

  if exists (
    select 1 from public.profiles
    where account_id = v_account and lower(email) = lower(trim(p_email))
  ) then
    raise exception 'Für diese E-Mail-Adresse existiert bereits ein Zugang.';
  end if;

  update public.team_invites
  set revoked_at = now()
  where account_id = v_account
    and lower(email) = lower(trim(p_email))
    and used_at is null
    and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.team_invites(account_id, email, full_name, token_hash, created_by, expires_at)
  values (v_account, lower(trim(p_email)), trim(coalesce(p_full_name, '')), encode(digest(v_token, 'sha256'), 'hex'), auth.uid(), v_expiry);

  return query select v_token, v_expiry;
end;
$$;

create or replace function public.list_team_invites()
returns table(
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.email, i.full_name, i.created_at, i.expires_at, i.used_at, i.revoked_at
  from public.team_invites i
  where public.current_user_is_admin()
    and i.account_id = public.current_account_id()
  order by i.created_at desc
$$;

create or replace function public.revoke_team_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Nur Administratoren dürfen Einladungen widerrufen.';
  end if;
  update public.team_invites
  set revoked_at = now()
  where id = p_invite_id
    and account_id = public.current_account_id()
    and used_at is null;
end;
$$;

create or replace function public.set_team_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Nur Administratoren dürfen Zugänge ändern.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Der eigene Administratorzugang kann nicht gesperrt werden.';
  end if;

  update public.profiles
  set active = p_active
  where id = p_user_id
    and account_id = public.current_account_id()
    and role <> 'admin';

  if not found then
    raise exception 'Benutzer nicht gefunden oder nicht änderbar.';
  end if;
end;
$$;

-- Auth-Trigger: Nur gültige Einladungen dürfen neue Teamkonten erzeugen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_invite public.team_invites%rowtype;
begin
  v_token := nullif(new.raw_user_meta_data ->> 'invite_token', '');

  if v_token is null then
    raise exception 'Für die Registrierung ist eine gültige CostPilot-Einladung erforderlich.';
  end if;

  select * into v_invite
  from public.team_invites
  where token_hash = encode(digest(v_token, 'sha256'), 'hex')
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found or lower(v_invite.email) <> lower(coalesce(new.email, '')) then
    raise exception 'Die Einladung ist ungültig, abgelaufen oder gehört zu einer anderen E-Mail-Adresse.';
  end if;

  insert into public.profiles(id, account_id, role, active, email, full_name)
  values (new.id, v_invite.account_id, 'member', true, coalesce(new.email, ''), v_invite.full_name)
  on conflict (id) do update set
    account_id = excluded.account_id,
    role = 'member',
    active = true,
    email = excluded.email,
    full_name = excluded.full_name;

  update public.team_invites
  set used_at = now(), used_by = new.id
  where id = v_invite.id;

  return new;
end;
$$;

-- Berechtigungen für die Client-RPCs.
grant execute on function public.create_team_invite(text, text) to authenticated;
grant execute on function public.list_team_invites() to authenticated;
grant execute on function public.revoke_team_invite(uuid) to authenticated;
grant execute on function public.set_team_user_active(uuid, boolean) to authenticated;
