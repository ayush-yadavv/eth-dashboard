import { handleRouteError, ok } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";
import { isOverdue } from "@/lib/date";
import { toUiTaskStatus } from "@/lib/task-status";

type DashboardTask = {
  id: string;
  title: string;
  due_date: string | null;
  status: "start" | "hold_pause" | "finish" | "todo" | "in_progress" | "done";
  project_id: string;
  assignee_user_id: string | null;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const projectSearch = requestUrl.searchParams.get("projectSearch")?.trim().toLowerCase() ?? "";
    const projectPage = Math.max(1, Number(requestUrl.searchParams.get("projectPage") ?? "1") || 1);
    const projectPageSize = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get("projectPageSize") ?? "8") || 8));
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

    const roleByProjectId = new Map((memberships ?? []).map((membership) => [membership.project_id, membership.role]));
    const visibleTasks = ((tasks ?? []) as DashboardTask[]).map((task) => ({
      ...task,
      status: toUiTaskStatus(task.status as never),
    })).filter((task) => {
      const role = roleByProjectId.get(task.project_id);
      if (!role) return false;
      return role === "admin" || task.assignee_user_id === user.id;
    });

    const openTasks = visibleTasks.filter((task) => task.status !== "finish");
    const completedTasks = visibleTasks.filter((task) => task.status === "finish");
    const overdueTasks = visibleTasks.filter((task) => task.status !== "finish" && isOverdue(task.due_date));
    const assignedToMe = visibleTasks.filter((task) => task.assignee_user_id === user.id);
    const dueSoon = openTasks
      .filter((task) => task.due_date !== null)
      .slice(0, 8);

    const projectSummaries = (memberships ?? []).map((membership) => {
      const projectRecord = Array.isArray(membership.project) ? membership.project[0] : membership.project;
      const project = {
        id: projectRecord?.id ?? membership.project_id,
        name: projectRecord?.name ?? "Untitled project",
        description: projectRecord?.description ?? null,
      };
      const projectTasks = visibleTasks.filter((task) => task.project_id === membership.project_id);
      const done = projectTasks.filter((task) => task.status === "finish").length;
      const total = projectTasks.length;
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);

      return {
        projectId: membership.project_id,
        role: membership.role,
        project,
        tasksTotal: total,
        tasksDone: done,
        progress,
      };
    });

    const filteredProjects = projectSearch.length > 0
      ? projectSummaries.filter((item) => {
          const name = item.project?.name?.toLowerCase() ?? "";
          const description = item.project?.description?.toLowerCase() ?? "";
          return name.includes(projectSearch) || description.includes(projectSearch);
        })
      : projectSummaries;
    const projectsTotal = filteredProjects.length;
    const projectsTotalPages = Math.max(1, Math.ceil(projectsTotal / projectPageSize));
    const safeProjectPage = Math.min(projectPage, projectsTotalPages);
    const projectsFrom = (safeProjectPage - 1) * projectPageSize;
    const pagedProjects = filteredProjects.slice(projectsFrom, projectsFrom + projectPageSize);

    return ok({
      summary: {
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        assignedToMe: assignedToMe.length,
      },
      projects: pagedProjects,
      projectsPagination: {
        page: safeProjectPage,
        pageSize: projectPageSize,
        total: projectsTotal,
        totalPages: projectsTotalPages,
      },
      overdueTasks,
      dueSoon,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
