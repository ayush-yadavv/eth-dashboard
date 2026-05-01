import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/app/profile-editor";

type JoinedProject = {
  id: string;
  name: string;
  description?: string | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: memberships, error: membershipsError }, { data: assignedTasks, error: tasksError }] =
    await Promise.all([
      supabase
        .from("project_members")
        .select("project_id,role,project:projects!inner(id,name,description)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id,title,status,due_date,project_id,project:projects!inner(id,name)")
        .eq("assignee_user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

  if (membershipsError || tasksError) {
    return (
      <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {membershipsError?.message ?? tasksError?.message ?? "Could not load profile details"}
        </p>
      </div>
    );
  }

  const projectItems = (memberships ?? [])
    .map((membership) => {
      const project = firstRelation(membership.project) as JoinedProject | null;
      if (!project) return null;
      return {
        projectId: membership.project_id,
        role: membership.role,
        name: project.name,
        description: project.description ?? null,
      };
    })
    .filter((item): item is { projectId: string; role: string; name: string; description: string | null } => item !== null);

  const assignedTaskItems = (assignedTasks ?? [])
    .map((task) => {
      const project = firstRelation(task.project) as JoinedProject | null;
      if (!project) return null;
      return {
        id: task.id,
        projectId: task.project_id,
        title: task.title,
        status: task.status,
        dueDate: task.due_date,
        projectName: project.name,
      };
    })
    .filter(
      (item): item is { id: string; projectId: string; title: string; status: string; dueDate: string | null; projectName: string } =>
        item !== null,
    );

  return (
    <div className="space-y-6">
      <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <ProfileEditor
          userId={user.id}
          email={profile?.email ?? user.email ?? "n/a"}
          initialFullName={profile?.full_name ?? null}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">My Projects</h2>
        <div className="mt-3 space-y-2">
          {projectItems.length === 0 ? <p className="text-sm text-muted-foreground">You are not part of any project yet.</p> : null}
          {projectItems.map((item) => (
            <Link
              key={item.projectId}
              href={`/projects/${item.projectId}`}
              className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs uppercase text-muted-foreground">{item.role}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.description ?? "No description"}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Tasks Assigned To Me</h2>
        <div className="mt-3 space-y-2">
          {assignedTaskItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks are currently assigned to you.</p>
          ) : null}
          {assignedTaskItems.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${task.projectId}`}
              className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{task.title}</span>
                <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {task.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {task.projectName} | due {task.dueDate ?? "none"}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
