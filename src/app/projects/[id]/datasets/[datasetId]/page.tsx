import DatasetExplorer from '@/components/DatasetExplorer';

export default async function DatasetPage({ params }: { params: Promise<{ id: string; datasetId: string }> }) {
  const resolvedParams = await params;
  return <DatasetExplorer projectId={resolvedParams.id} datasetId={resolvedParams.datasetId} />;
}
