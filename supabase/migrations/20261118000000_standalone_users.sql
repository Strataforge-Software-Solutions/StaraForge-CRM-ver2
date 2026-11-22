-- Standalone CRM accounts. Password and authenticator data never references auth.users.
create table if not exists public.users (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  display_name text not null default '' check (length(display_name) <= 120),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'pending' check (status in ('active', 'pending', 'mfa_setup', 'disabled')),
  password_hash text,
  google_sub text,
  totp_secret text,
  totp_pending_secret text,
  totp_last_verified_counter bigint,
  session_version integer not null default 0,
  invite_token_hash text,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index if not exists users_workspace_role_idx on public.users(workspace_id, role);
create unique index if not exists users_google_sub_idx on public.users(google_sub) where google_sub is not null;

create table if not exists public.user_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid,
  target_user_id uuid,
  action text not null check (length(action) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists user_audit_events_workspace_time_idx on public.user_audit_events(workspace_id, created_at desc);
alter table public.user_audit_events enable row level security;
revoke all on public.user_audit_events from anon, authenticated;

create table if not exists public.auth_login_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);
alter table public.auth_login_limits enable row level security;
revoke all on public.auth_login_limits from anon, authenticated;

create or replace function public.register_auth_login_attempt(target_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  still_allowed boolean;
begin
  if random() < 0.02 then
    delete from public.auth_login_limits where window_started_at < now() - interval '1 day';
  end if;
  insert into public.auth_login_limits as current_limit (key_hash, attempts, window_started_at, blocked_until)
  values (target_hash, 1, now(), null)
  on conflict (key_hash) do update set
    attempts = case when current_limit.window_started_at < now() - interval '15 minutes' then 1 else current_limit.attempts + 1 end,
    window_started_at = case when current_limit.window_started_at < now() - interval '15 minutes' then now() else current_limit.window_started_at end,
    blocked_until = case
      when current_limit.blocked_until > now() then current_limit.blocked_until
      when current_limit.window_started_at < now() - interval '15 minutes' then null
      when current_limit.attempts + 1 >= 8 then now() + interval '15 minutes'
      else null
    end;
  select blocked_until is null or blocked_until <= now() into still_allowed
  from public.auth_login_limits where key_hash = target_hash;
  return still_allowed;
end;
$$;

create or replace function public.clear_auth_login_attempts(target_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_login_limits where key_hash = target_hash;
$$;

create or replace function public.consume_totp_counter(target_user uuid, next_counter bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set totp_last_verified_counter = next_counter
  where id = target_user
    and (totp_last_verified_counter is null or totp_last_verified_counter < next_counter);
  return found;
end;
$$;

revoke all on function public.register_auth_login_attempt(text) from public, anon, authenticated;
revoke all on function public.clear_auth_login_attempts(text) from public, anon, authenticated;
revoke all on function public.consume_totp_counter(uuid, bigint) from public, anon, authenticated;
grant execute on function public.register_auth_login_attempt(text) to service_role;
grant execute on function public.clear_auth_login_attempts(text) to service_role;
grant execute on function public.consume_totp_counter(uuid, bigint) to service_role;

-- Preserve the current roster and IDs. Passwords are deliberately not copied from Auth;
-- the first workspace administrator sets a new password through the one-time bootstrap flow.
do $$
declare
  member_row record;
begin
  for member_row in
    select user_id, workspace_id, lower(email) as email, display_name, role
    from public.workspace_members
  loop
    begin
      insert into public.users (id, workspace_id, email, display_name, role, status)
      values (member_row.user_id, member_row.workspace_id, member_row.email, member_row.display_name, member_row.role, 'active');
    exception when unique_violation then
      null;
    end;
  end loop;
end
$$;

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;
grant all on public.auth_login_limits to service_role;
grant all on public.user_audit_events to service_role;
