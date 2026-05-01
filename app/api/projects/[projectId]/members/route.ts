import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireProjectRole, verifyProjectAdminWithServiceRole } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMemberSchema } from "@/lib/validation/schemas";
import { addDays } from "@/lib/date";
import { generateInviteToken, hashInviteToken } from "@/lib/security/tokens";
import { sendInviteEmail } from "@/lib/email/resend";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    await requireProjectRole(projectId, "member");
    const serviceClient = createAdminClient();
    const { data: memberRows, error } = await serviceClient
      .from("project_members")
      .select("project_id,user_id,role,joined_at,added_by")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const userIds = (memberRows ?? []).map((row) => row.user_id);
    const { data: profiles, error: profilesError } = userIds.length
      ? await serviceClient.from("profiles").select("id,email,full_name").in("id", userIds)
      : { data: [], error: null };

    if (profilesError) {
      return Response.json({ error: profilesError.message }, { status: 500 });
    }

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const members = (memberRows ?? []).map((row) => ({
      ...row,
      profiles: profileById.get(row.user_id) ?? null,
    }));

    return ok({ members });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const payload = await parseJsonBody(request, addMemberSchema);
    const { adminClient, user } = await verifyProjectAdminWithServiceRole(projectId);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id,email")
      .eq("email", payload.email)
      .maybeSingle();

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      const token = generateInviteToken();
      const tokenHash = hashInviteToken(token);
      const expiresAt = addDays(7);
      const invitePath = `/invitations/${token}`;

      const { error: inviteError } = await adminClient.from("project_invitations").insert({
        project_id: projectId,
        invited_email: payload.email,
        invited_by: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      if (inviteError) {
        return Response.json({ error: inviteError.message }, { status: 400 });
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
          success: true,
          action: "invited",
          invitation: {
            invitedEmail: payload.email,
            expiresAt,
            invitePath,
          },
        },
        201,
      );
    }

    const { error: memberError } = await adminClient.from("project_members").upsert(
      {
        project_id: projectId,
        user_id: profile.id,
        role: payload.role,
        added_by: user.id,
      },
      { onConflict: "project_id,user_id" },
    );

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 400 });
    }

    return ok({ success: true, action: "added", member: { projectId, userId: profile.id, role: payload.role } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
