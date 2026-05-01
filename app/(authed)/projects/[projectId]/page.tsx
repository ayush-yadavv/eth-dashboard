import { ProjectClient } from "@/components/app/project-client";

type Params = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: Params) {
  const { projectId } = await params;
  return <ProjectClient projectId={projectId} />;
}
