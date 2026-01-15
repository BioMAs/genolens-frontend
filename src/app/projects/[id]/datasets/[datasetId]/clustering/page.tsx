'use client';

import { useParams } from 'next/navigation';
import ClusteringAnalysis from '@/components/analysis/ClusteringAnalysis';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import api from '@/utils/api';

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
    <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Sub-header / Breadcrumb */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <Link 
                href={`/projects/${projectId}/datasets/${datasetId}`}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Back to Dataset"
            >
                <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-4 w-px bg-gray-300"></div>
            <span className="text-gray-500 text-sm font-medium">Dataset Analysis</span>
            <span className="text-gray-300">/</span>
            <h1 className="text-gray-900 font-semibold text-sm">
                {datasetName || 'Loading...'} 
            </h1>
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">
                Clustering
            </span>
        </div>

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
