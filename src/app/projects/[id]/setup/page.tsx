import AnalysisWizard from '@/components/wizard/AnalysisWizard';

export default async function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisWizard projectId={id} />;
}
