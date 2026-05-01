import { handleRouteError, ok } from "@/lib/api/http";
import { requireProjectRole } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { role, user } = await requireProjectRole(projectId, "member");
    const adminClient = createAdminClient();

    const { data: openRow, error: openError } = await adminClient
      .from("member_attendance")
      .select("id,punched_in_at,punched_out_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("punched_out_at", null)
      .maybeSingle();

    if (openError) {
      return Response.json({ error: openError.message }, { status: 500 });
    }

    if (role !== "admin") {
      const { data: myLogs, error: myLogsError } = await adminClient
        .from("member_attendance")
        .select("id,user_id,punched_in_at,punched_out_at,created_at")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .order("punched_in_at", { ascending: false })
        .limit(20);

      if (myLogsError) {
        return Response.json({ error: myLogsError.message }, { status: 500 });
      }

      return ok({
        role,
        activeSession: openRow,
        myLogs: myLogs ?? [],
        teamLogs: [],
      });
    }

    const { data: teamLogs, error: teamLogsError } = await adminClient
      .from("member_attendance")
      .select("id,project_id,user_id,punched_in_at,punched_out_at,created_at")
      .eq("project_id", projectId)
      .order("punched_in_at", { ascending: false })
      .limit(100);

    if (teamLogsError) {
      return Response.json({ error: teamLogsError.message }, { status: 500 });
    }

    return ok({
      role,
      activeSession: openRow,
      myLogs: (teamLogs ?? []).filter((row) => row.user_id === user.id).slice(0, 20),
      teamLogs: teamLogs ?? [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
