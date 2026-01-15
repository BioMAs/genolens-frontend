import ProjectDetail from '@/components/ProjectDetail';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ProjectDetail projectId={resolvedParams.id} />;
}
