import AnalysisLauncher from '@/components/analyses/AnalysisLauncher';
import { PageHeader } from '@/components/ui/page-header';

export default async function NewAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    /* `mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8` etait la deuxieme
       enveloppe de page du produit, avec sa propre largeur et ses propres
       gouttieres. `.page-container` porte les deux, et `data-measure="prose"`
       dit la largeur au lieu de la coder.

       Le lien « ← Back to analyses » disparait : le fil d'Ariane de la barre
       superieure dit deja d'ou l'on vient, et PageHeader l'alimente. */
    <div className="page-container" data-measure="prose">
      <PageHeader
        title="New Multi-Method Analysis"
        description="Upload your count matrix, sample metadata, and comparisons file. Results will be produced by DESeq2 + edgeR + limma-voom combined with Stouffer’s method."
        crumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Analyses', href: `/projects/${id}/analyses` },
          { label: 'New analysis' },
        ]}
      />
      <AnalysisLauncher projectId={id} />
    </div>
  );
}
