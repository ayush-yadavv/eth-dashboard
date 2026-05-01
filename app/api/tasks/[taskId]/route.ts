import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";
import { canManageProject, canUpdateTask } from "@/lib/auth/permissions";
import { updateTaskSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ taskId: string }> };

async function getTaskForUser(taskId: string, userId: string) {
  const { supabase } = await requireUser();
  const { data: membershipRows, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id,role")
    .eq("user_id", userId);

  if (membershipError) {
    throw new ApiError(500, membershipError.message);
  }

  const projectIds = (membershipRows ?? []).map((row) => row.project_id);
  if (projectIds.length === 0) {
    throw new ApiError(403, "You are not a member of this task's project");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,project_id,assignee_user_id")
    .eq("id", taskId)
    .in("project_id", projectIds)
    .maybeSingle();

  if (taskError) {
    throw new ApiError(500, taskError.message);
  }

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const membership = membershipRows?.find((row) => row.project_id === task.project_id);
  if (!membership) {
    throw new ApiError(403, "You are not a member of this task's project");
  }

  return { supabase, membershipRole: membership.role as "admin" | "member", task };
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { taskId } = await params;
    const payload = await parseJsonBody(request, updateTaskSchema);
    const { user } = await requireUser();
    const { supabase, task, membershipRole } = await getTaskForUser(taskId, user.id);

    if (!canUpdateTask(membershipRole, user.id, task.assignee_user_id)) {
      throw new ApiError(403, "Only project admins or the assignee can update this task");
    }

    if (payload.assigneeUserId) {
      const { data: assignee, error: assigneeError } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", task.project_id)
        .eq("user_id", payload.assigneeUserId)
        .maybeSingle();

      if (assigneeError) {
        return Response.json({ error: assigneeError.message }, { status: 500 });
      }

      if (!assignee) {
        throw new ApiError(400, "Assignee must be a project member");
      }
    }

    const updatePayload: Record<string, string | null> = {};
    if (payload.title !== undefined) updatePayload.title = payload.title;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.dueDate !== undefined) updatePayload.due_date = payload.dueDate;
    if (payload.assigneeUserId !== undefined) updatePayload.assignee_user_id = payload.assigneeUserId;

    if (Object.keys(updatePayload).length === 0) {
      throw new ApiError(400, "At least one task field must be provided");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("id,project_id,title,description,status,due_date,assignee_user_id,created_by,created_at,updated_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ task: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { taskId } = await params;
    const { user } = await requireUser();
    const { supabase, task, membershipRole } = await getTaskForUser(taskId, user.id);

    if (!canManageProject(membershipRole)) {
      throw new ApiError(403, "Only project admins can delete tasks");
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("project_id", task.project_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
