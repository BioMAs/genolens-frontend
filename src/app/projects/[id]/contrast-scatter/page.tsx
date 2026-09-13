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
import { PageHeader } from '@/components/ui/page-header';

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
            <Lock className="mx-auto mb-4 h-8 w-8 text-muted" />
            <h1 className="mb-2 text-title text-primary">Scientific tools add-on</h1>
            <p className="mx-auto max-w-md text-body-sm text-secondary">
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
      <div className="p-8">
        <div className="page-container text-center py-12 text-secondary">Loading...</div>
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
            <div className="text-red-600 mb-4">{error || 'Not enough comparisons'}</div>
            <p className="text-body-sm text-secondary">
              This feature compares two DEG contrasts, so the project needs at least two.
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
          title="Contrast comparison"
          description={project ? `Project: ${project.name}` : undefined}
          crumbs={[
            { label: 'Projects', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Contrast comparison' },
          ]}
        />
        <ContrastScatter pathDatasetId={pathDatasetId} comparisons={comparisons} />
    </div>
  );
}
