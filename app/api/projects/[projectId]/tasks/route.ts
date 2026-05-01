import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireProjectRole } from "@/lib/auth/context";
import { createTaskSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { supabase, user, role } = await requireProjectRole(projectId, "member");

    let query = supabase
      .from("tasks")
      .select("id,project_id,title,description,status,due_date,assignee_user_id,created_by,created_at,updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (role === "member") {
      query = query.eq("assignee_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return ok({ tasks: data ?? [] });
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
        status: payload.status,
        due_date: payload.dueDate ?? null,
        assignee_user_id: payload.assigneeUserId ?? null,
        created_by: user.id,
      })
      .select("id,project_id,title,description,status,due_date,assignee_user_id,created_by,created_at,updated_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ task: data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
