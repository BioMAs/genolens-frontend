import ReadingPage from '@/components/reading/ReadingPage';

export default async function ComparisonPage({ params }: { params: Promise<{ id: string; comparisonName: string }> }) {
  const resolvedParams = await params;
  return <ReadingPage projectId={resolvedParams.id} comparisonName={resolvedParams.comparisonName} />;
}
