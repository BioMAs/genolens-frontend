'use client';

import { Suspense } from 'react';

import DrugDiscovery from '@/components/tools/DrugDiscovery';
import { PageHeader } from '@/components/ui/page-header';

export default function DrugDiscoveryPage() {
  return (
    <div className="page-container">
      {/* La tuile d'icone portait `bg-rose-100 text-rose-700` — de la palette
          Tailwind brute, hors du systeme de couleur. Elle part avec les deux
          autres : un titre de page n'a pas besoin d'etre illustre.

          La phrase de description a deja ete corrigee une fois : elle disait
          « The module does not read any of your data », devenu faux le jour ou
          le mode B a ete cable. Une mention de confidentialite perimee coute
          plus que l'absence de mention. */}
      <PageHeader
        eyebrow="Tools"
        title="Drug Discovery"
        description={
          <>
            Ranking of therapeutic targets across 33 TCGA indications, from curated public
            sources. This page ranks public data only — to confront your own
            differential-expression comparison with a ranking, open the{' '}
            <strong>Drug targets</strong> tab on that comparison.
          </>
        }
        crumbs={[{ label: 'Tools', href: '/tools' }, { label: 'Drug Discovery' }]}
      />

      {/* useSearchParams impose une frontière Suspense en App Router. */}
      <Suspense fallback={<p className="text-body-sm text-secondary">Loading…</p>}>
        <DrugDiscovery />
      </Suspense>
    </div>
  );
}
