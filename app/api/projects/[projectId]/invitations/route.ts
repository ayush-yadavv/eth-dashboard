import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireProjectRole, verifyProjectAdminWithServiceRole } from "@/lib/auth/context";
import { inviteMemberSchema } from "@/lib/validation/schemas";
import { addDays } from "@/lib/date";
import { generateInviteToken, hashInviteToken } from "@/lib/security/tokens";
import { sendInviteEmail } from "@/lib/email/resend";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { supabase } = await requireProjectRole(projectId, "admin");
    const { data, error } = await supabase
      .from("project_invitations")
      .select("id,project_id,invited_email,invited_by,expires_at,accepted_at,created_at")
      .eq("project_id", projectId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return ok({ invitations: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const payload = await parseJsonBody(request, inviteMemberSchema);
    const { adminClient, user } = await verifyProjectAdminWithServiceRole(projectId);

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = addDays(payload.expiresInDays);
    const invitePath = `/invitations/${token}`;

    const { error } = await adminClient.from("project_invitations").insert({
      project_id: projectId,
      invited_email: payload.email,
      invited_by: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const [{ data: project }, { data: inviterProfile }] = await Promise.all([
      adminClient.from("projects").select("name").eq("id", projectId).maybeSingle(),
      adminClient.from("profiles").select("email").eq("id", user.id).maybeSingle(),
    ]);

    try {
      await sendInviteEmail({
        to: payload.email,
        invitedByEmail: inviterProfile?.email ?? user.email ?? "Team admin",
        projectName: project?.name ?? "Team Task Manager",
        invitePath,
        expiresAt,
      });
    } catch (emailError) {
      return Response.json(
        {
          error:
            emailError instanceof Error
              ? `Invitation created but email failed: ${emailError.message}`
              : "Invitation created but email failed",
        },
        { status: 502 },
      );
    }

    return ok(
      {
        invitation: {
          invitedEmail: payload.email,
          expiresAt,
          inviteToken: token,
          invitePath,
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
