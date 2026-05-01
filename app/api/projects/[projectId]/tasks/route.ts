import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireProjectRole } from "@/lib/auth/context";
import { toDbTaskStatus, toUiTaskStatus } from "@/lib/task-status";
import { createTaskSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { supabase, user, role } = await requireProjectRole(projectId, "member");
    const url = new URL(_.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const assigneeUserId = url.searchParams.get("assigneeUserId")?.trim() ?? "";
    const dueFrom = url.searchParams.get("dueFrom")?.trim() ?? "";
    const dueTo = url.searchParams.get("dueTo")?.trim() ?? "";
    const sortByParam = url.searchParams.get("sortBy")?.trim() ?? "created_at";
    const sortOrderParam = url.searchParams.get("sortOrder")?.trim() ?? "desc";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = (["created_at", "due_date", "title", "status"] as const).includes(sortByParam as never)
      ? sortByParam
      : "created_at";
    const sortOrder = sortOrderParam === "asc" ? "asc" : "desc";

    let query = supabase
      .from("tasks")
      .select("id,project_id,title,description,status,due_date,assignee_user_id,created_by,created_at,updated_at", {
        count: "exact",
      })
      .eq("project_id", projectId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: false });

    if (role === "member") {
      query = query.eq("assignee_user_id", user.id);
    }
    if (search.length > 0) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (status.length > 0) {
      query = query.eq("status", toDbTaskStatus(status as never));
    }
    if (assigneeUserId.length > 0) {
      query = query.eq("assignee_user_id", assigneeUserId);
    }
    if (dueFrom.length > 0) {
      query = query.gte("due_date", dueFrom);
    }
    if (dueTo.length > 0) {
      query = query.lte("due_date", dueTo);
    }

    const { data, error, count } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const tasks = (data ?? []).map((task) => ({
      ...task,
      status: toUiTaskStatus(task.status as never),
    }));

    return ok({
      tasks,
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const payload = await parseJsonBody(request, createTaskSchema);
    const { supabase, user } = await requireProjectRole(projectId, "admin");

    if (payload.assigneeUserId) {
      const { data: assignee, error: assigneeError } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", payload.assigneeUserId)
        .maybeSingle();

      if (assigneeError) {
        return Response.json({ error: assigneeError.message }, { status: 500 });
      }

      if (!assignee) {
        throw new ApiError(400, "Assignee must be a project member");
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: payload.title,
        description: payload.description ?? null,
        status: toDbTaskStatus(payload.status),
        due_date: payload.dueDate ?? null,
        assignee_user_id: payload.assigneeUserId ?? null,
        created_by: user.id,
      })
      .select("id,project_id,title,description,status,due_date,assignee_user_id,created_by,created_at,updated_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok(
      {
        task: {
          ...data,
          status: toUiTaskStatus(data.status as never),
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
