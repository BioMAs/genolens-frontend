import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { buildSearchIndex } from '@/lib/docs';
import DocsIndex from '@/components/docs/DocsIndex';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Documentation — GenoLens',
  description:
    'How to use GenoLens: preparing your files, running an analysis, reading and sharing the results.',
};

export default async function DocsPage() {
  // Même garde que les autres pages de l'application : les guides décrivent
  // les écrans, les modules payants et leurs limites, et s'adressent aux
  // utilisateurs connectés.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const docs = buildSearchIndex();

  return (
    <div className="page-container">
      <PageHeader
        title="Documentation"
        description="How to prepare your data, run an analysis, and read and share the results."
        crumbs={[{ label: 'Documentation' }]}
      />
      <DocsIndex docs={docs} />
    </div>
  );
}
