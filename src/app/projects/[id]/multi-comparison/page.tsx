'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/utils/api';
import { Project, Dataset } from '@/types';
import MultiComparisonVenn, { ComparisonRef } from '@/components/MultiComparisonVenn';
import { buildComparisonRefs } from '@/lib/comparisonRefs';
import { PageHeader } from '@/components/ui/page-header';

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
    /* L'en-tete etait une BANDE pleine largeur — `bg-surface border-b
       border-line` — suivie d'un `page-container` separe pour le contenu.
       Troisieme enveloppe de page du produit, et une bande bordee est
       exactement ce que la regle L1 interdit : on ne borde pas pour grouper.
       Un seul conteneur, et l'en-tete pose dessus. */
    <div className="page-container">
        <PageHeader
          title="Multi-Comparison Analysis"
          description={project ? `Project: ${project.name}` : undefined}
          crumbs={[
            { label: 'Projects', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Multi-comparison' },
          ]}
        />
        <MultiComparisonVenn
          projectId={projectId}
          pathDatasetId={pathDatasetId}
          comparisons={comparisons}
        />
    </div>
  );
}
