import ComparisonDetail from '@/components/ComparisonDetail';

export default async function ComparisonPage({ params }: { params: Promise<{ id: string; comparisonName: string }> }) {
  const resolvedParams = await params;
  return <ComparisonDetail projectId={resolvedParams.id} comparisonName={resolvedParams.comparisonName} />;
}
