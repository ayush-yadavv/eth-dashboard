import { ApiError } from "@/lib/api/errors";
import { handleRouteError, ok } from "@/lib/api/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/context";
import { hashInviteToken } from "@/lib/security/tokens";

type Params = { params: Promise<{ token: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { token } = await params;
    const { user } = await requireUser();
    const adminClient = createAdminClient();
    const tokenHash = hashInviteToken(token);

    const { data: invitation, error: invitationError } = await adminClient
      .from("project_invitations")
      .select("id,project_id,invited_email,expires_at,accepted_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (invitationError) {
      return Response.json({ error: invitationError.message }, { status: 500 });
    }

    if (!invitation) {
      throw new ApiError(404, "Invitation not found");
    }

    if (invitation.accepted_at) {
      throw new ApiError(400, "Invitation already accepted");
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new ApiError(400, "Invitation has expired");
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.email.toLowerCase() !== invitation.invited_email.toLowerCase()) {
      throw new ApiError(403, "This invitation is for a different email");
    }

    const { error: membershipError } = await adminClient.from("project_members").upsert(
      {
        project_id: invitation.project_id,
        user_id: user.id,
        role: "member",
        added_by: user.id,
      },
      { onConflict: "project_id,user_id" },
    );

    if (membershipError) {
      return Response.json({ error: membershipError.message }, { status: 400 });
    }

    const { error: updateError } = await adminClient
      .from("project_invitations")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invitation.id);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 400 });
    }

    return ok({ success: true, projectId: invitation.project_id });
  } catch (error) {
    return handleRouteError(error);
  }
}
