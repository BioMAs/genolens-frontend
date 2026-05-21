import AnalysesListView from '@/components/analyses/AnalysesListView';

export default async function AnalysesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AnalysesListView projectId={id} />
    </div>
  );
}
