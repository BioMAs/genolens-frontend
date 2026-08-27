'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import api from '@/utils/api';
import { Project, Dataset } from '@/types';
import type { ComparisonRef } from '@/components/MultiComparisonVenn';
import ContrastScatter from '@/components/ContrastScatter';
import { buildComparisonRefs } from '@/lib/comparisonRefs';
import { useScientificModule } from '@/hooks/useAddOnModules';

export default function ContrastScatterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const { unlocked: scienceUnlocked, loaded: moduleLoaded } = useScientificModule();

  const [project, setProject] = useState<Project | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonRef[]>([]);
  const [pathDatasetId, setPathDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectResponse = await api.get(`/projects/${projectId}`);
        setProject(projectResponse.data);

        const datasetsResponse = await api.get(`/datasets/project/${projectId}`);
        const datasets: Dataset[] = datasetsResponse.data;
        const refs = buildComparisonRefs(datasets);

        if (refs.length < 2) {
          setError('This feature requires at least two DEG comparisons in the project.');
        } else {
          setComparisons(refs);
          setPathDatasetId(refs[0].datasetId);
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

  // Add-on gate: the route can be typed straight into the address bar, so the
  // page states its own requirement instead of relying on the hidden nav entry.
  if (moduleLoaded && !scienceUnlocked) {
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
            <Lock className="mx-auto mb-4 h-8 w-8 text-gray-400" />
            <h1 className="mb-2 text-lg font-semibold text-gray-900">Scientific tools add-on</h1>
            <p className="mx-auto max-w-md text-sm text-gray-600">
              Contrast scatter is part of the Scientific tools module. Ask an admin to enable
              it for your account, or request access from your profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto text-center py-12 text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !pathDatasetId || comparisons.length < 2) {
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
            <div className="text-red-600 mb-4">{error || 'Not enough comparisons'}</div>
            <p className="text-sm text-gray-600">
              This feature compares two DEG contrasts, so the project needs at least two.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Contrast comparison</h1>
          {project && <p className="mt-2 text-sm text-gray-600">Project: {project.name}</p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContrastScatter pathDatasetId={pathDatasetId} comparisons={comparisons} />
      </div>
    </div>
  );
}
