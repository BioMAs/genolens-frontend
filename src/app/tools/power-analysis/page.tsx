'use client';

import PowerAnalysis from '@/components/tools/PowerAnalysis';
import { PageHeader } from '@/components/ui/page-header';

export default function PowerAnalysisPage() {
  return (
    <div className="page-container">
      {/* La tuile d'icone de 36px a cote d'un titre de 30px ne dit rien que le
          titre ne dise : c'est de la decoration posee sur une interface de
          donnees. Le sur-titre porte la categorie, qui elle informe. */}
      <PageHeader
        eyebrow="Tools"
        title="Power Analysis"
        description="Calculate the required sample size or evaluate the statistical power of a test based on the expected effect, threshold α, and risk β."
        crumbs={[{ label: 'Tools', href: '/tools' }, { label: 'Power Analysis' }]}
      />
      <PowerAnalysis />
    </div>
  );
}
