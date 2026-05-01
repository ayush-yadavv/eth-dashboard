import { ApiError } from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectRole } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "Authentication required");
  }

  return { supabase, user };
}

export async function requireProjectRole(projectId: string, minimumRole: ProjectRole) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data) {
    throw new ApiError(403, "You are not a member of this project");
  }

  if (minimumRole === "admin" && data.role !== "admin") {
    throw new ApiError(403, "Admin role required");
  }

  return { supabase, user, role: data.role as ProjectRole };
}

export async function verifyProjectAdminWithServiceRole(projectId: string) {
  const { user } = await requireUser();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data || data.role !== "admin") {
    throw new ApiError(403, "Admin role required");
  }

  return { adminClient, user };
}
