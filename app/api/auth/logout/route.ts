import { handleRouteError, ok } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/context";

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
