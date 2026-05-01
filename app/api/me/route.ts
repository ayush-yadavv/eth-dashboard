import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";
import { updateProfileSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
      await Promise.all([
        supabase.from("profiles").select("id,email,full_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("project_members")
          .select("project_id,role,projects:project_id(id,name)")
          .eq("user_id", user.id),
      ]);

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    if (membershipError) {
      return Response.json({ error: membershipError.message }, { status: 500 });
    }

    return ok({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile,
      memberships: memberships ?? [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser();
    const payload = await parseJsonBody(request, updateProfileSchema);
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email ?? "",
        full_name: payload.fullName,
      })
      .select("id,email,full_name")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ profile: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
