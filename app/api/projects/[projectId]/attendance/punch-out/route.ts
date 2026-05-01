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
      .select("id,punched_in_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("punched_out_at", null)
      .maybeSingle();

    if (existingOpenError) {
      return Response.json({ error: existingOpenError.message }, { status: 500 });
    }

    if (!existingOpen) {
      throw new ApiError(400, "No active punch-in session found");
    }

    const now = new Date().toISOString();
    const { data, error } = await adminClient
      .from("member_attendance")
      .update({
        punched_out_at: now,
      })
      .eq("id", existingOpen.id)
      .select("id,punched_in_at,punched_out_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(now).getTime() - new Date(existingOpen.punched_in_at).getTime()) / 1000),
    );

    return ok({ session: data, durationSeconds });
  } catch (error) {
    return handleRouteError(error);
  }
}
