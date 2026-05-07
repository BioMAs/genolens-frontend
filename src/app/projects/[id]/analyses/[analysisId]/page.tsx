import AnalysisResultsHub from '@/components/analyses/AnalysisResultsHub';

export default async function AnalysisResultsPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string }>;
}) {
  const { id, analysisId } = await params;
  return <AnalysisResultsHub projectId={id} analysisId={analysisId} />;
}
