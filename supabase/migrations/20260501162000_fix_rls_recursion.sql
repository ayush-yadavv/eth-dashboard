create schema if not exists private;

drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_update_admin on public.projects;
drop policy if exists projects_delete_admin on public.projects;

drop policy if exists project_members_select_member on public.project_members;
drop policy if exists project_members_insert_admin on public.project_members;
drop policy if exists project_members_delete_admin on public.project_members;

drop policy if exists project_invitations_select_admin on public.project_invitations;
drop policy if exists project_invitations_insert_admin on public.project_invitations;
drop policy if exists project_invitations_update_admin on public.project_invitations;

drop policy if exists tasks_select_member on public.tasks;
drop policy if exists tasks_insert_member on public.tasks;
drop policy if exists tasks_update_admin_or_assignee on public.tasks;
drop policy if exists tasks_delete_admin on public.tasks;

drop function if exists public.is_project_member(uuid);
drop function if exists public.is_project_admin(uuid);

create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function private.is_project_admin(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'admin'
  );
$$;

revoke all on function private.is_project_member(uuid) from public;
revoke all on function private.is_project_admin(uuid) from public;
grant execute on function private.is_project_member(uuid) to authenticated, service_role;
grant execute on function private.is_project_admin(uuid) to authenticated, service_role;

create policy projects_select_member
on public.projects
for select
to authenticated
using ((select private.is_project_member(id)));

create policy projects_update_admin
on public.projects
for update
to authenticated
using ((select private.is_project_admin(id)))
with check ((select private.is_project_admin(id)));

create policy projects_delete_admin
on public.projects
for delete
to authenticated
using ((select private.is_project_admin(id)));

create policy project_members_select_member
on public.project_members
for select
to authenticated
using ((select private.is_project_member(project_id)));

create policy project_members_insert_admin
on public.project_members
for insert
to authenticated
with check ((select private.is_project_admin(project_id)));

create policy project_members_delete_admin
on public.project_members
for delete
to authenticated
using ((select private.is_project_admin(project_id)));

create policy project_invitations_select_admin
on public.project_invitations
for select
to authenticated
using ((select private.is_project_admin(project_id)));

create policy project_invitations_insert_admin
on public.project_invitations
for insert
to authenticated
with check (
  (select private.is_project_admin(project_id))
  and invited_by = auth.uid()
);

create policy project_invitations_update_admin
on public.project_invitations
for update
to authenticated
using ((select private.is_project_admin(project_id)))
with check ((select private.is_project_admin(project_id)));

create policy tasks_select_member
on public.tasks
for select
to authenticated
using ((select private.is_project_member(project_id)));

create policy tasks_insert_member
on public.tasks
for insert
to authenticated
with check (
  (select private.is_project_member(project_id))
  and created_by = auth.uid()
);

create policy tasks_update_admin_or_assignee
on public.tasks
for update
to authenticated
using (
  (select private.is_project_admin(project_id))
  or assignee_user_id = auth.uid()
)
with check (
  (select private.is_project_admin(project_id))
  or assignee_user_id = auth.uid()
);

create policy tasks_delete_admin
on public.tasks
for delete
to authenticated
using ((select private.is_project_admin(project_id)));
