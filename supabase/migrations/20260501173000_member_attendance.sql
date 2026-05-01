create table public.member_attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  punched_in_at timestamptz not null default now(),
  punched_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_attendance_out_after_in check (
    punched_out_at is null or punched_out_at >= punched_in_at
  )
);

create index member_attendance_project_idx on public.member_attendance(project_id, punched_in_at desc);
create index member_attendance_user_idx on public.member_attendance(user_id, punched_in_at desc);
create unique index member_attendance_single_open_idx
  on public.member_attendance(project_id, user_id)
  where punched_out_at is null;

create trigger set_member_attendance_updated_at
before update on public.member_attendance
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.member_attendance enable row level security;

create policy member_attendance_select_member
on public.member_attendance
for select
to authenticated
using ((select private.is_project_member(project_id)));

create policy member_attendance_insert_self
on public.member_attendance
for insert
to authenticated
with check (
  (select private.is_project_member(project_id))
  and user_id = auth.uid()
);

create policy member_attendance_update_self_or_admin
on public.member_attendance
for update
to authenticated
using (
  user_id = auth.uid()
  or (select private.is_project_admin(project_id))
)
with check (
  user_id = auth.uid()
  or (select private.is_project_admin(project_id))
);
