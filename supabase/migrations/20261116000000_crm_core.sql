-- StrataForge CRM hosted data model. This creates empty tables and does not seed demo records.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (workspace_id, email)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);

create table if not exists public.crm_collections (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection_key text not null check (length(collection_key) between 1 and 160),
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, collection_key)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.touch_crm_collection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists crm_collections_touch on public.crm_collections;
create trigger crm_collections_touch before insert or update on public.crm_collections
for each row execute function public.touch_crm_collection();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.crm_collections enable row level security;

drop policy if exists "members read their workspace" on public.workspaces;
create policy "members read their workspace" on public.workspaces
for select to authenticated
using (public.is_workspace_member(id) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "members read workspace roster" on public.workspace_members;
create policy "members read workspace roster" on public.workspace_members
for select to authenticated
using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "members read workspace collections" on public.crm_collections;
create policy "members read workspace collections" on public.crm_collections
for select to authenticated
using (public.is_workspace_member(workspace_id) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "members insert workspace collections" on public.crm_collections;
create policy "members insert workspace collections" on public.crm_collections
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "members update workspace collections" on public.crm_collections;
create policy "members update workspace collections" on public.crm_collections
for update to authenticated
using (public.is_workspace_member(workspace_id) and (select auth.jwt() ->> 'aal') = 'aal2')
with check (public.is_workspace_member(workspace_id) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "members delete workspace collections" on public.crm_collections;
create policy "members delete workspace collections" on public.crm_collections
for delete to authenticated
using (public.is_workspace_member(workspace_id) and (select auth.jwt() ->> 'aal') = 'aal2');

revoke all on public.workspaces, public.workspace_members, public.crm_collections from anon;
revoke all on public.workspaces, public.workspace_members, public.crm_collections from authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.crm_collections to authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
