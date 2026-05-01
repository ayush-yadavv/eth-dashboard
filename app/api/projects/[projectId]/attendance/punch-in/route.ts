import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok } from "@/lib/api/http";
import { requireProjectRole } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user } = await requireProjectRole(projectId, "member");
    const adminClient = createAdminClient();

    const { data: existingOpen, error: existingOpenError } = await adminClient
      .from("member_attendance")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("punched_out_at", null)
      .maybeSingle();

    if (existingOpenError) {
      return Response.json({ error: existingOpenError.message }, { status: 500 });
    }

    if (existingOpen) {
      throw new ApiError(400, "You are already punched in");
    }

    const { data, error } = await adminClient
      .from("member_attendance")
      .insert({
        project_id: projectId,
        user_id: user.id,
        punched_in_at: new Date().toISOString(),
      })
      .select("id,punched_in_at,punched_out_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ session: data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
