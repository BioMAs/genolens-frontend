'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/utils/api';
import { Project, Dataset, DatasetType } from '@/types';
import MultiComparisonVenn, { ComparisonRef } from '@/components/MultiComparisonVenn';

interface ComparisonMetaShape {
  deg_total?: number;
  deg_up?: number;
  deg_down?: number;
}

/**
 * Flatten every comparison across all DEG datasets in the project into a single
 * list of refs (one entry per comparison, tagged with its owning dataset). This
 * supports both a single "global" multi-comparison dataset and several
 * single-comparison datasets.
 */
function buildComparisonRefs(datasets: Dataset[]): ComparisonRef[] {
  const degDatasets = datasets.filter((d) => d.type === DatasetType.DEG);
  const refs: ComparisonRef[] = [];

  const degCountOf = (meta: ComparisonMetaShape | undefined): number => {
    if (!meta) return 0;
    if (typeof meta.deg_total === 'number') return meta.deg_total;
    return (meta.deg_up || 0) + (meta.deg_down || 0);
  };

  const add = (datasetId: string, comparisonName: string, degCount: number) => {
    refs.push({
      // datasetId::comparisonName is unique: a dataset can't hold two
      // comparisons with the same name. Used as the selection id.
      key: `${datasetId}::${comparisonName}`,
      datasetId,
      comparisonName,
      label: comparisonName,
      degCount,
    });
  };

  for (const d of degDatasets) {
    const metadata = (d.dataset_metadata || {}) as Record<string, unknown>;
    const columnsInfo = metadata.columns_info as Record<string, unknown> | undefined;
    const rawComparisons = metadata.comparisons ?? columnsInfo?.comparisons;

    if (Array.isArray(rawComparisons) && rawComparisons.length > 0) {
      // Legacy single-comparison datasets store comparisons as a list of names
      for (const entry of rawComparisons) {
        const comparisonName =
          typeof entry === 'string' ? entry : ((entry as { name?: string })?.name ?? d.name);
        add(d.id, comparisonName, degCountOf(metadata as ComparisonMetaShape));
      }
    } else if (
      rawComparisons &&
      typeof rawComparisons === 'object' &&
      Object.keys(rawComparisons).length > 0
    ) {
      // "Global" dataset: comparisons is a dict keyed by comparison name
      const comparisonsMap = rawComparisons as Record<string, ComparisonMetaShape>;
      for (const [name, meta] of Object.entries(comparisonsMap)) {
        add(d.id, name, degCountOf(meta));
      }
    } else {
      // Fallback: explicit comparison_name, else dataset name
      add(d.id, (metadata.comparison_name as string) || d.name, degCountOf(metadata as ComparisonMetaShape));
    }
  }

  // Make `label` unique (the backend keys Venn sets by label). When a comparison
  // name is shared, prefix with the dataset name; if that still collides
  // (homonymous datasets from different analyses), append a numeric suffix.
  const datasetName = new Map(degDatasets.map((d) => [d.id, d.name]));
  const nameCounts = new Map<string, number>();
  for (const r of refs) nameCounts.set(r.comparisonName, (nameCounts.get(r.comparisonName) || 0) + 1);
  for (const r of refs) {
    if ((nameCounts.get(r.comparisonName) || 0) > 1) {
      const dn = datasetName.get(r.datasetId) ?? r.datasetId;
      if (dn && dn !== r.comparisonName) r.label = `${dn}: ${r.comparisonName}`;
    }
  }
  const seen = new Map<string, number>();
  for (const r of refs) {
    const n = (seen.get(r.label) || 0) + 1;
    seen.set(r.label, n);
    if (n > 1) r.label = `${r.label} (${n})`;
  }

  return refs;
}

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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        </div>
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
          pathDatasetId={pathDatasetId}
          comparisons={comparisons}
        />
      </div>
    </div>
  );
}
