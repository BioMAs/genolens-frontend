'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/utils/api';
import { Project, Dataset, DatasetType } from '@/types';
import MultiComparisonVenn from '@/components/MultiComparisonVenn';

export default function MultiComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [degDataset, setDegDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project
        const projectResponse = await api.get(`/projects/${projectId}`);
        setProject(projectResponse.data);

        // Fetch datasets to find global DEG dataset
        const datasetsResponse = await api.get(`/projects/${projectId}/datasets`);
        const datasets = datasetsResponse.data;

        // Find global DEG dataset (has multiple comparisons)
        const globalDeg = datasets.find((d: Dataset) =>
          d.type === 'DEG' &&
          d.dataset_metadata?.comparisons &&
          Object.keys(d.dataset_metadata.comparisons).length > 1
        );

        if (!globalDeg) {
          setError('No multi-comparison DEG dataset found in this project');
        } else {
          setDegDataset(globalDeg);
        }
      } catch (err) {
        console.error('Failed to fetch project data:', err);
        setError('Failed to load project data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !degDataset) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </button>

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-red-600 mb-4">
              {error || 'No multi-comparison DEG dataset found'}
            </div>
            <p className="text-sm text-gray-600">
              This feature requires a DEG dataset with multiple comparisons.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Multi-Comparison Analysis
            </h1>
            {project && (
              <p className="mt-2 text-sm text-gray-600">
                Project: {project.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MultiComparisonVenn
          projectId={projectId}
          degDataset={degDataset}
        />
      </div>
    </div>
  );
}
