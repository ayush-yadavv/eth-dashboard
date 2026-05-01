const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

export function getSupabasePublicEnv() {
  const values = requiredPublicEnv.map((key) => process.env[key]);
  const missing = requiredPublicEnv.filter((_, index) => !values[index]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  };
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return serviceRoleKey;
}

export function isEmailVerificationDisabled() {
  return process.env.SUPABASE_DISABLE_EMAIL_VERIFICATION === "true";
}

export function getResendEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!apiKey) {
    throw new Error("Missing required environment variable: RESEND_API_KEY");
  }
  if (!fromEmail) {
    throw new Error("Missing required environment variable: RESEND_FROM_EMAIL");
  }
  if (!appBaseUrl) {
    throw new Error("Missing required environment variable: APP_BASE_URL");
  }

  return { apiKey, fromEmail, appBaseUrl };
}
