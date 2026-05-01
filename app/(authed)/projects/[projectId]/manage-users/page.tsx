import { ManageUsersClient } from "@/components/app/manage-users-client";

type Params = {
  params: Promise<{ projectId: string }>;
};

export default async function ManageUsersPage({ params }: Params) {
  const { projectId } = await params;
  return <ManageUsersClient projectId={projectId} />;
}
