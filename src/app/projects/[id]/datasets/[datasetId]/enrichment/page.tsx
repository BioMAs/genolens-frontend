'use client';

import { useParams } from 'next/navigation';
import EnrichmentAnalysis from '@/components/analysis/EnrichmentAnalysis';
import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { PageHeader } from '@/components/ui/page-header';

export default function EnrichmentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const datasetId = params.datasetId as string;
  const [datasetName, setDatasetName] = useState<string>('');

  useEffect(() => {
      api.get(`/datasets/${datasetId}`).then(res => {
          setDatasetName(res.data.name);
      }).catch(err => console.error(err));
  }, [datasetId]);

  return (
    /* Un fil d'Ariane ecrit A LA MAIN vivait dans une bande bordee, avec sa
       fleche de retour, son separateur en `bg-hover` — du gris Tailwind
       brut — et trois liens recopies. La barre superieure porte deja ce fil ;
       `PageHeader` l'alimente, donc la bande entiere disparait. */
    <div className="page-container">
      <PageHeader
        eyebrow="Enrichment"
        title="Functional Enrichment Analysis"
        description="Explore enriched pathways and gene sets (GO, KEGG, Reactome) for your differential expression comparisons."
        crumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Project', href: `/projects/${projectId}` },
          {
            label: datasetName || datasetId,
            href: `/projects/${projectId}/datasets/${datasetId}`,
          },
          { label: 'Enrichment' },
        ]}
      />
      <EnrichmentAnalysis datasetId={datasetId} />
    </div>
  );
}
