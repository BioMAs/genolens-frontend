'use client';

import { useParams } from 'next/navigation';
import EnrichmentAnalysis from '@/components/analysis/EnrichmentAnalysis';
import { ArrowLeft, Grid } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import api from '@/utils/api';

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
    <div className="flex flex-col min-h-screen bg-surface-2">
        {/* Sub-header / Breadcrumb */}
        <div className="bg-surface border-b border-line px-4 py-3 flex items-center gap-3 shadow-sm">
            <Link 
                href={`/projects/${projectId}/datasets/${datasetId}`}
                className="text-secondary hover:text-primary transition-colors"
                title="Back to Dataset"
            >
                <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-5 w-px bg-gray-300 mx-1"></div>
            <div className="flex items-center gap-2 text-sm">
                 <Link href={`/projects/${projectId}`} className="text-secondary hover:underline">
                    Project
                 </Link>
                 <span className="text-muted">/</span>
                 <Link href={`/projects/${projectId}/datasets/${datasetId}`} className="text-secondary hover:underline font-medium">
                    {datasetName || datasetId}
                 </Link>
                 <span className="text-muted">/</span>
                 <span className="text-accent-ink font-semibold flex items-center gap-1">
                    <Grid className="h-3 w-3" />
                    Enrichment Analysis
                 </span>
            </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                   <h1 className="text-2xl font-bold text-primary tracking-tight">Functional Enrichment Analysis</h1>
                   <p className="text-sm text-secondary mt-1">
                       Explore enriched pathways and gene sets (GO, KEGG, Reactome) for your differential expression comparisons.
                   </p>
                </div>
            </div>

            <EnrichmentAnalysis datasetId={datasetId} />
        </div>
    </div>
  );
}
