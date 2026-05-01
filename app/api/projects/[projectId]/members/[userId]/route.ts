import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { verifyProjectAdminWithServiceRole } from "@/lib/auth/context";
import { updateMemberRoleSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ projectId: string; userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, userId } = await params;
    const payload = await parseJsonBody(request, updateMemberRoleSchema);
    const { adminClient, user } = await verifyProjectAdminWithServiceRole(projectId);

    if (user.id === userId && payload.role !== "admin") {
      return Response.json({ error: "Project admins cannot demote themselves" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("project_members")
      .update({ role: payload.role, added_by: user.id })
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { projectId, userId } = await params;
    const { adminClient, user } = await verifyProjectAdminWithServiceRole(projectId);

    if (user.id === userId) {
      return Response.json({ error: "Project admins cannot remove themselves" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
