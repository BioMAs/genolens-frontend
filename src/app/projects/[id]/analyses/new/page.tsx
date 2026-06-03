import Link from 'next/link';
import AnalysisLauncher from '@/components/analyses/AnalysisLauncher';

export default async function NewAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href={`/projects/${id}/analyses`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to analyses
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New Multi-Method Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your count matrix, sample metadata, and comparisons file.
          Results will be produced by DESeq2 + edgeR + limma-voom combined with Stouffer&apos;s method.
        </p>
      </div>
      <AnalysisLauncher projectId={id} />
    </div>
  );
}
