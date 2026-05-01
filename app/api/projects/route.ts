import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("project_members")
      .select("role,project:projects!inner(id,name,description,created_by,created_at,updated_at)")
      .order("joined_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return ok({ projects: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const payload = await parseJsonBody(request, projectCreateSchema);
    const adminClient = createAdminClient();

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
      id: user.id,
      email: user.email ?? "",
      full_name:
        typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
          ? user.user_metadata.full_name.trim()
          : null,
    });

    if (profileUpsertError) {
      return Response.json({ error: profileUpsertError.message }, { status: 400 });
    }

    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .insert({
        name: payload.name,
        description: payload.description ?? null,
        created_by: user.id,
      })
      .select("id,name,description,created_by,created_at,updated_at")
      .single();

    if (projectError || !project) {
      return Response.json({ error: projectError?.message ?? "Project could not be created" }, { status: 400 });
    }

    const { error: memberError } = await adminClient.from("project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "admin",
      added_by: user.id,
    });

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 400 });
    }

    return ok({ project }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
