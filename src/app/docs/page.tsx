import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { buildSearchIndex } from '@/lib/docs';
import DocsIndex from '@/components/docs/DocsIndex';

export const metadata: Metadata = {
  title: 'Documentation — GenoLens',
  description: 'Guides for analysing, exploring and sharing transcriptomics results.',
};

export default async function DocsPage() {
  // Même garde que les autres pages de l'application. Ces guides étaient de
  // la documentation interne : plusieurs détaillent les endpoints de l'API
  // sous « Backend API », et la page était servie en HTML statique, donc
  // lisible sans compte.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

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
