'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/utils/api';
import { Project, Dataset } from '@/types';
import MultiComparisonVenn, { ComparisonRef } from '@/components/MultiComparisonVenn';
import { buildComparisonRefs } from '@/lib/comparisonRefs';

export default function MultiComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonRef[]>([]);
  const [pathDatasetId, setPathDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project
        const projectResponse = await api.get(`/projects/${projectId}`);
        setProject(projectResponse.data);

        // Fetch datasets and flatten comparisons across all DEG datasets
        const datasetsResponse = await api.get(`/datasets/project/${projectId}`);
        const datasets: Dataset[] = datasetsResponse.data;

        const refs = buildComparisonRefs(datasets);

        if (refs.length < 2) {
          setError('No multi-comparison DEG dataset found in this project');
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="page-container">
          <div className="text-center py-12">
            <div className="text-secondary">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pathDatasetId || comparisons.length < 2) {
    return (
      <div className="p-8">
        <div className="page-container">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-6 inline-flex items-center text-body-sm text-secondary hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </button>

          <div className="bg-surface rounded-card shadow p-8 text-center">
            <div className="text-red-600 mb-4">
              {error || 'No multi-comparison DEG dataset found'}
            </div>
            <p className="text-body-sm text-secondary">
              This feature requires a DEG dataset with multiple comparisons.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="bg-surface border-b border-line">
        <div className="page-container">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-4 inline-flex items-center text-body-sm text-secondary hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </button>

          <div>
            <h1 className="text-display text-primary">
              Multi-Comparison Analysis
            </h1>
            {project && (
              <p className="mt-2 text-body-sm text-secondary">
                Project: {project.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-container">
        <MultiComparisonVenn
          projectId={projectId}
          pathDatasetId={pathDatasetId}
          comparisons={comparisons}
        />
      </div>
    </div>
  );
}
