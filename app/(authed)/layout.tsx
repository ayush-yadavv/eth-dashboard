import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthedShell } from "@/components/app/authed-shell";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AuthedShell userEmail={user.email ?? ""}>{children}</AuthedShell>;
}
