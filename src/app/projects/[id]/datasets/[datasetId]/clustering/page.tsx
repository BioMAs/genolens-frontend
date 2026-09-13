'use client';

import { useParams } from 'next/navigation';
import ClusteringAnalysis from '@/components/analysis/ClusteringAnalysis';
import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { PageHeader } from '@/components/ui/page-header';

export default function ClusteringPage() {
  const params = useParams();
  const projectId = params.id as string;
  const datasetId = params.datasetId as string;
  const [datasetName, setDatasetName] = useState<string>('');

  // Optional: Fetch dataset name for breadcrumb/title
  useEffect(() => {
      api.get(`/datasets/${datasetId}`).then(res => {
          setDatasetName(res.data.name);
      }).catch(err => console.error(err));
  }, [datasetId]);

  return (
    /* Meme bande de fil d'Ariane ecrite a la main que sur l'ecran
       d'enrichissement, separateurs en `bg-hover` compris — et un `<h1>`
       rendu a `text-body-sm`, soit 13px : le titre de l'ecran y etait PLUS
       PETIT que son propre corps de texte. */
    <div className="page-container">
      <PageHeader
        eyebrow="Clustering"
        title={datasetName || 'Loading…'}
        titleVariant="name"
        crumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Project', href: `/projects/${projectId}` },
          {
            label: datasetName || datasetId,
            href: `/projects/${projectId}/datasets/${datasetId}`,
          },
          { label: 'Clustering' },
        ]}
      />

      {/* Main Content */}
      <div className="flex-1">
             <ClusteringAnalysis 
                projectId={projectId} 
                datasetId={datasetId} 
                datasetName={datasetName} 
        />
      </div>
    </div>
  );
}
