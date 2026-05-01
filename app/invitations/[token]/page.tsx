import { redirect } from "next/navigation";
import { InvitationAccept } from "@/components/app/invitation-accept";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: Params) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <InvitationAccept token={token} />;
}
