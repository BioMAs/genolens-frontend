'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useAnalysis } from '@/hooks/useAnalyses';
import { useProjectSummary, useProjectDatasets, ComparisonSummary } from '@/hooks/useProjectData';
import { SelfServiceAnalysisStatus, Dataset, DatasetType, DatasetStatus } from '@/types';
import PreprocessingResults from './PreprocessingResults';
import PCAResults from './PCAResults';
import UMAPResults from './UMAPResults';
import ComparisonGrid from './ComparisonGrid';

type Tab = 'preprocessing' | 'pca' | 'umap' | 'comparisons' | 'params';

const TAB_LABELS: Record<Tab, string> = {
  preprocessing: 'Preprocessing',
  pca:           'PCA',
  umap:          'UMAP',
  comparisons:   'Comparisons',
  params:        'Parameters',
};

interface Props {
  projectId: string;
  analysisId: string;
}

export default function AnalysisResultsHub({ projectId, analysisId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('comparisons');
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<SelfServiceAnalysisStatus | null>(null);

  const { data: analysis, isLoading: analysisLoading } = useAnalysis(analysisId);
  const { data: summary } = useProjectSummary(projectId);
  const { data: datasets = [] } = useProjectDatasets(projectId);

  // When analysis transitions to DONE, invalidate the datasets cache so the
  // VST/normalized intermediate datasets (with PCA + QC data) are fetched.
  useEffect(() => {
    if (!analysis) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = analysis.status;
    if (
      analysis.status === SelfServiceAnalysisStatus.DONE &&
      prev !== SelfServiceAnalysisStatus.DONE
    ) {
      queryClient.invalidateQueries({ queryKey: ['datasets', 'project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'comparisons'] });
    }
  }, [analysis?.status, projectId, queryClient]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Comparisons linked to this analysis (via result_dataset_ids)
  const allComparisons: ComparisonSummary[] = summary?.comparisons ?? [];
  const analysisComparisons = useMemo(() => {
    if (!analysis) return allComparisons;
    const resultIds = new Set(analysis.result_dataset_ids ?? []);
    const filtered = allComparisons.filter((c) => resultIds.has(c.dataset_id));
    // If no match via dataset_id, show all (fallback for older analyses)
    return filtered.length > 0 ? filtered : allComparisons;
  }, [analysis, allComparisons]);

  // VST dataset (for PCA data embedded in metadata)
  const vstDataset = useMemo<Dataset | undefined>(() => {
    const vstId = analysis?.intermediate_dataset_ids?.vst;
    if (vstId) return datasets.find((d) => d.id === vstId);
    // Fallback: find a MATRIX dataset with source=vst linked to this analysis
    return datasets.find(
      (d) =>
        d.type === DatasetType.MATRIX &&
        d.dataset_metadata?.source === 'vst' &&
        d.dataset_metadata?.analysis_id === analysisId
    );
  }, [datasets, analysis, analysisId]);

  // PCA data embedded in the VST dataset metadata
  const pcaData = vstDataset?.dataset_metadata?.pca_data ?? null;

  // UMAP dataset
  const umapDataset = useMemo<Dataset | undefined>(() => {
    const umapId = analysis?.intermediate_dataset_ids?.umap;
    if (umapId) return datasets.find((d) => d.id === umapId);
    return datasets.find(
      (d) =>
        d.type === DatasetType.METADATA &&
        d.dataset_metadata?.source === 'umap' &&
        d.dataset_metadata?.analysis_id === analysisId
    );
  }, [datasets, analysis, analysisId]);

  const umapData = umapDataset?.dataset_metadata?.umap_data ?? null;

  // QC report embedded in VST dataset metadata (or normalized dataset)
  const qcReport = useMemo(() => {
    if (vstDataset?.dataset_metadata?.qc_report) {
      return vstDataset.dataset_metadata.qc_report;
    }
    const normId = analysis?.intermediate_dataset_ids?.normalized;
    if (normId) {
      const normDs = datasets.find((d) => d.id === normId);
      return normDs?.dataset_metadata?.qc_report ?? null;
    }
    return null;
  }, [vstDataset, analysis, datasets]);

  // Matrix dataset for clustering
  const matrixDataset = useMemo<Dataset | undefined>(() => {
    const matId = analysis?.matrix_dataset_id;
    if (matId) return datasets.find((d) => d.id === matId);
    return undefined;
  }, [datasets, analysis]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (analysisLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="text-gray-600">Analysis not found.</p>
          <Link href={`/projects/${projectId}`} className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
            ← Back to project
          </Link>
        </div>
      </div>
    );
  }

  const isDone = analysis.status === SelfServiceAnalysisStatus.DONE;
  const projectName = summary?.project?.name ?? 'Project';

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Breadcrumb */}
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> {projectName}
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                <FlaskConical className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{analysis.name}</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(analysis.created_at).toLocaleString('en-US')}
                  {' · '}
                  {analysisComparisons.length} comparison{analysisComparisons.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={analysis.status} />
              <Link
                href={`/projects/${projectId}/setup?rerun=${analysisId}`}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Re-run
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-gray-200 flex overflow-x-auto">
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {TAB_LABELS[tab]}
                {tab === 'comparisons' && analysisComparisons.length > 0 && (
                  <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600">
                    {analysisComparisons.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {/* ── Preprocessing ── */}
            {activeTab === 'preprocessing' && (
              <PreprocessingResults qcReport={qcReport} />
            )}

            {/* ── PCA ── */}
            {activeTab === 'pca' && (
              <PCAResults pcaData={pcaData} datasetId={vstDataset?.id} />
            )}

            {/* ── UMAP ── */}
            {activeTab === 'umap' && (
              <UMAPResults umapData={umapData} />
            )}

            {/* ── Comparisons ── */}
            {activeTab === 'comparisons' && (
              <ComparisonGrid
                projectId={projectId}
                analysisId={analysisId}
                comparisons={analysisComparisons}
                matrixDatasetId={matrixDataset?.id ?? null}
              />
            )}

            {/* ── Parameters ── */}
            {activeTab === 'params' && (
              <AnalysisParams analysis={analysis} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SelfServiceAnalysisStatus }) {
  const styles: Record<SelfServiceAnalysisStatus, string> = {
    [SelfServiceAnalysisStatus.PENDING]:   'bg-yellow-100 text-yellow-800',
    [SelfServiceAnalysisStatus.RUNNING]:   'bg-blue-100 text-blue-800',
    [SelfServiceAnalysisStatus.DONE]:      'bg-green-100 text-green-800',
    [SelfServiceAnalysisStatus.FAILED]:    'bg-red-100 text-red-800',
    [SelfServiceAnalysisStatus.CANCELLED]: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<SelfServiceAnalysisStatus, string> = {
    [SelfServiceAnalysisStatus.PENDING]:   'Pending',
    [SelfServiceAnalysisStatus.RUNNING]:   'Running',
    [SelfServiceAnalysisStatus.DONE]:      'Done',
    [SelfServiceAnalysisStatus.FAILED]:    'Failed',
    [SelfServiceAnalysisStatus.CANCELLED]: 'Cancelled',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function AnalysisParams({ analysis }: { analysis: ReturnType<typeof useAnalysis>['data'] }) {
  if (!analysis) return null;
  const params = analysis.params ?? {};

  const rows: { label: string; value: string }[] = [
    { label: 'DESeq2 design',        value: String(params.design ?? 'auto') },
    { label: 'FDR threshold',        value: String(params.fdr ?? 0.05) },
    { label: 'Min |log2FC|',         value: String(params.min_log2fc ?? 1.0) },
    { label: 'Min reads / sample',   value: Number(params.min_reads ?? 100000).toLocaleString() },
    { label: 'Min genes / sample',   value: Number(params.min_genes ?? 500).toLocaleString() },
    { label: 'Min count / gene',     value: String(params.min_count ?? 10) },
    { label: 'Min replicates',       value: String(params.min_reps ?? 2) },
    { label: 'Threads',              value: String(params.threads ?? 1) },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">DESeq2 Parameters</h3>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-4 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
          >
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs font-semibold font-mono text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      <Link
        href={`/projects/${analysis.project_id}/setup?rerun=${analysis.id}`}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Re-run with new parameters
      </Link>
    </div>
  );
}
