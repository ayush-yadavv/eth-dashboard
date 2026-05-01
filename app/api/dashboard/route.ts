import { handleRouteError, ok } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";
import { isOverdue } from "@/lib/date";

type DashboardTask = {
  id: string;
  title: string;
  due_date: string | null;
  status: "start" | "hold_pause" | "finish";
  project_id: string;
  assignee_user_id: string | null;
};

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    const [{ data: memberships, error: membershipError }, { data: tasks, error: taskError }] =
      await Promise.all([
        supabase
          .from("project_members")
          .select("project_id,role,project:projects!inner(id,name,description)")
          .eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("id,title,due_date,status,project_id,assignee_user_id")
          .order("due_date", { ascending: true, nullsFirst: false }),
      ]);

    if (membershipError) {
      return Response.json({ error: membershipError.message }, { status: 500 });
    }

    if (taskError) {
      return Response.json({ error: taskError.message }, { status: 500 });
    }

    const typedTasks = (tasks ?? []) as DashboardTask[];
    const openTasks = typedTasks.filter((task) => task.status !== "finish");
    const completedTasks = typedTasks.filter((task) => task.status === "finish");
    const overdueTasks = typedTasks.filter((task) => task.status !== "finish" && isOverdue(task.due_date));
    const assignedToMe = typedTasks.filter((task) => task.assignee_user_id === user.id);
    const dueSoon = openTasks
      .filter((task) => task.due_date !== null)
      .slice(0, 8);

    const projectSummaries = (memberships ?? []).map((membership) => {
      const projectTasks = typedTasks.filter((task) => task.project_id === membership.project_id);
      const done = projectTasks.filter((task) => task.status === "finish").length;
      const total = projectTasks.length;
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);

      return {
        projectId: membership.project_id,
        role: membership.role,
        project: membership.project,
        tasksTotal: total,
        tasksDone: done,
        progress,
      };
    });

    return ok({
      summary: {
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        assignedToMe: assignedToMe.length,
      },
      projects: projectSummaries,
      overdueTasks,
      dueSoon,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
