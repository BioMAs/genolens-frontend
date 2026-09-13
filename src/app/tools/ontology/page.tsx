'use client';

import GoBrowser from '@/components/tools/GoBrowser';
import { PageHeader } from '@/components/ui/page-header';

export default function OntologyPage() {
  return (
    /* L'enveloppe `py-8` doublait le padding : `.page-container` porte deja
       32px en haut et 96 en bas. */
    <div className="page-container">
      <PageHeader
        eyebrow="Tools"
        title="Gene Ontology Browser"
        description="Search and explore the Gene Ontology (GO) hierarchy. Find terms, view definitions, and navigate relationships."
        crumbs={[{ label: 'Tools', href: '/tools' }, { label: 'Gene Ontology' }]}
      />
      <GoBrowser />
    </div>
  );
}
