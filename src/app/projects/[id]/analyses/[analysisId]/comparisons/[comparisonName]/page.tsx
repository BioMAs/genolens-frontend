import ReadingPage from '@/components/reading/ReadingPage';

export default async function AnalysisComparisonPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string; comparisonName: string }>;
}) {
  const { id, analysisId, comparisonName } = await params;
  return (
    <ReadingPage
      projectId={id}
      analysisId={analysisId}
      comparisonName={comparisonName}
    />
  );
}
