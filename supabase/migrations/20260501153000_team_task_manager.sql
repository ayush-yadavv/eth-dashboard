create extension if not exists pgcrypto;

create type public.project_role as enum ('admin', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'done');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.project_role not null default 'member',
  joined_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null,
  primary key (project_id, user_id)
);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  status public.task_status not null default 'todo',
  due_date date,
  assignee_user_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_assignee_membership_fk
    foreign key (project_id, assignee_user_id)
    references public.project_members(project_id, user_id)
    on delete set null
);

create index projects_created_by_idx on public.projects(created_by);
create index project_members_user_idx on public.project_members(user_id);
create index project_invitations_project_idx on public.project_invitations(project_id);
create index project_invitations_email_idx on public.project_invitations(lower(invited_email));
create index project_invitations_expires_idx on public.project_invitations(expires_at);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_assignee_idx on public.tasks(assignee_user_id);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_project_invitations_updated_at
before update on public.project_invitations
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_current_timestamp_updated_at();

create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_admin(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.tasks enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy projects_select_member
on public.projects
for select
to authenticated
using (public.is_project_member(id));

create policy projects_insert_authenticated
on public.projects
for insert
to authenticated
with check (created_by = auth.uid());

create policy projects_update_admin
on public.projects
for update
to authenticated
using (public.is_project_admin(id))
with check (public.is_project_admin(id));

create policy projects_delete_admin
on public.projects
for delete
to authenticated
using (public.is_project_admin(id));

create policy project_members_select_member
on public.project_members
for select
to authenticated
using (public.is_project_member(project_id));

create policy project_members_insert_admin
on public.project_members
for insert
to authenticated
with check (public.is_project_admin(project_id));

create policy project_members_delete_admin
on public.project_members
for delete
to authenticated
using (public.is_project_admin(project_id));

create policy project_invitations_select_admin
on public.project_invitations
for select
to authenticated
using (public.is_project_admin(project_id));

create policy project_invitations_insert_admin
on public.project_invitations
for insert
to authenticated
with check (
  public.is_project_admin(project_id)
  and invited_by = auth.uid()
);

create policy project_invitations_update_admin
on public.project_invitations
for update
to authenticated
using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

create policy tasks_select_member
on public.tasks
for select
to authenticated
using (public.is_project_member(project_id));

create policy tasks_insert_member
on public.tasks
for insert
to authenticated
with check (
  public.is_project_member(project_id)
  and created_by = auth.uid()
);

create policy tasks_update_admin_or_assignee
on public.tasks
for update
to authenticated
using (
  public.is_project_admin(project_id)
  or assignee_user_id = auth.uid()
)
with check (
  public.is_project_admin(project_id)
  or assignee_user_id = auth.uid()
);

create policy tasks_delete_admin
on public.tasks
for delete
to authenticated
using (public.is_project_admin(project_id));
