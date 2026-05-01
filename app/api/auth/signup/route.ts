import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { authSignupSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailVerificationDisabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request, authSignupSchema);
    const supabase = await createClient();

    if (isEmailVerificationDisabled()) {
      const adminClient = createAdminClient();
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          full_name: payload.fullName ?? null,
        },
      });

      if (createError) {
        return Response.json({ error: createError.message }, { status: 400 });
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (signInError) {
        return Response.json({ error: signInError.message }, { status: 400 });
      }

      return ok({
        user: createdUser.user
          ? {
              id: createdUser.user.id,
              email: createdUser.user.email,
            }
          : null,
        session: signInData.session ? { expiresAt: signInData.session.expires_at } : null,
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName ?? null,
        },
      },
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
