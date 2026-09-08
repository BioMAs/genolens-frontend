import type { Metadata } from 'next';
import { buildSearchIndex } from '@/lib/docs';
import DocsIndex from '@/components/docs/DocsIndex';

export const metadata: Metadata = {
  title: 'Documentation — GenoLens',
  description: 'Guides for analysing, exploring and sharing transcriptomics results.',
};

export default function DocsPage() {
  const docs = buildSearchIndex();

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="page-title">Documentation</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Guides for analysing, exploring and sharing your transcriptomics results.
        </p>
      </div>
      <DocsIndex docs={docs} />
    </div>
  );
}
