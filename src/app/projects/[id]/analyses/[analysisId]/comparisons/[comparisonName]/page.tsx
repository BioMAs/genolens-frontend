import ComparisonDetail from '@/components/ComparisonDetail';

export default async function AnalysisComparisonPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string; comparisonName: string }>;
}) {
  const { id, analysisId, comparisonName } = await params;
  return (
    <ComparisonDetail
      projectId={id}
      analysisId={analysisId}
      comparisonName={comparisonName}
    />
  );
}
