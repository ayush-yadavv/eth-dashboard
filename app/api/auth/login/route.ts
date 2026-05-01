import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { authLoginSchema } from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request, authLoginSchema);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return ok({
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
          }
        : null,
      session: data.session ? { expiresAt: data.session.expires_at } : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
