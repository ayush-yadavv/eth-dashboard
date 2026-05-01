import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireProjectRole } from "@/lib/auth/context";
import { projectUpdateSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { supabase } = await requireProjectRole(projectId, "member");

    const { data, error } = await supabase
      .from("projects")
      .select("id,name,description,created_by,created_at,updated_at")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      throw new ApiError(404, "Project not found");
    }

    return ok({ project: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const payload = await parseJsonBody(request, projectUpdateSchema);
    const { supabase } = await requireProjectRole(projectId, "admin");

    const updatePayload: Record<string, string | null> = {};
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.description !== undefined) updatePayload.description = payload.description;

    if (Object.keys(updatePayload).length === 0) {
      throw new ApiError(400, "At least one project field must be provided");
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .select("id,name,description,created_by,created_at,updated_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ project: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { supabase } = await requireProjectRole(projectId, "admin");
    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
