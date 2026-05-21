import ProjectHub from '@/components/ProjectHub';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ProjectHub projectId={resolvedParams.id} />;
}
