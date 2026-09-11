import AnalysesListView from '@/components/analyses/AnalysesListView';

export default async function AnalysesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="page-container">
      <AnalysesListView projectId={id} />
    </div>
  );
}
