'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Loader2, AlertCircle, RotateCcw, Database } from 'lucide-react';
import { useAnalysis } from '@/hooks/useAnalyses';
import { useProjectSummary, useProjectDatasets, ComparisonSummary } from '@/hooks/useProjectData';
import { SelfServiceAnalysisStatus, Dataset, DatasetType } from '@/types';
import PreprocessingResults from './PreprocessingResults';
import type { QCReport } from './PreprocessingResults';
import PCAPlot from '@/components/PCAPlot';
import UMAPPlot from '@/components/UMAPPlot';
import ComparisonGrid from './ComparisonGrid';
import DEGPatternsView from '@/components/DEGPatternsView';
import { useSampleConditionMap } from '@/hooks/useSampleConditionMap';

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.3px]" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

interface Props {
  projectId: string;
  analysisId: string;
}

function isQCReport(value: unknown): value is QCReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<QCReport>;
  return (
    typeof report.total_input_samples === 'number' &&
    typeof report.samples_passed === 'number' &&
    typeof report.samples_removed === 'number' &&
    typeof report.genes_before_filter === 'number' &&
    typeof report.genes_after_filter === 'number'
  );
}


export default function AnalysisResultsHub({ projectId, analysisId }: Props) {
  const [structureView, setStructureView] = useState<'pca' | 'umap'>('pca');
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
  }, [analysis, projectId, queryClient]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Comparisons linked to this analysis (via result_dataset_ids)
  const analysisComparisons = useMemo(() => {
    const allComparisons: ComparisonSummary[] = summary?.comparisons ?? [];
    if (!analysis) return allComparisons;
    const resultIds = new Set(analysis.result_dataset_ids ?? []);
    const filtered = allComparisons.filter((c) => resultIds.has(c.dataset_id));
    // If no match via dataset_id, show all (fallback for older analyses)
    return filtered.length > 0 ? filtered : allComparisons;
  }, [analysis, summary?.comparisons]);

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

  // Samples dataset — drives condition colouring of PCA/UMAP (and is the
  // metadata source for the on-demand PCA/UMAP plots computed from the VST).
  const samplesDataset = useMemo<Dataset | undefined>(() => {
    const sid = analysis?.samples_dataset_id;
    return sid ? datasets.find((d) => d.id === sid) : undefined;
  }, [datasets, analysis]);

  // QC report embedded in VST dataset metadata (or normalized dataset)
  const qcReport = useMemo<QCReport | null>(() => {
    const vstQcReport = vstDataset?.dataset_metadata?.qc_report;
    if (isQCReport(vstQcReport)) {
      return vstQcReport;
    }
    const normId = analysis?.intermediate_dataset_ids?.normalized;
    if (normId) {
      const normDs = datasets.find((d) => d.id === normId);
      const normQcReport = normDs?.dataset_metadata?.qc_report;
      return isQCReport(normQcReport) ? normQcReport : null;
    }
    return null;
  }, [vstDataset, analysis, datasets]);

  // Matrix dataset for clustering
  const matrixDataset = useMemo<Dataset | undefined>(() => {
    const matId = analysis?.matrix_dataset_id;
    if (matId) return datasets.find((d) => d.id === matId);
    return undefined;
  }, [datasets, analysis]);

  // Full {sample -> condition} map (all analysis conditions) for DEG patterns
  const { data: sampleConditionMap } = useSampleConditionMap(samplesDataset);

  // DEG sources for analysis-level pattern clustering: union across all comparisons
  const degSources = useMemo(
    () => analysisComparisons.map((c) => ({ dataset_id: c.dataset_id, comparison_name: c.name })),
    [analysisComparisons]
  );

  // ── Loading / error states ────────────────────────────────────────────────

  if (analysisLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p style={{ color: 'var(--text-secondary)' }}>Analysis not found.</p>
          <Link href={`/projects/${projectId}`} className="mt-3 inline-block text-sm text-indigo-500 hover:underline">
            ← Back to project
          </Link>
        </div>
      </div>
    );
  }

  const projectName = summary?.project?.name ?? 'Project';

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--app-bg)' }}>
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Breadcrumb */}
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" /> {projectName}
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-2xl shadow-sm px-6 py-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                <FlaskConical className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{analysis.name}</h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date(analysis.created_at).toLocaleString('en-US')}
                  {' · '}
                  {analysisComparisons.length} comparison{analysisComparisons.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const meta = matrixDataset?.dataset_metadata as
                  | { source?: string; geo_accession?: string }
                  | undefined;
                if (meta?.source !== 'GEO' || !meta.geo_accession) return null;
                return (
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${meta.geo_accession}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Data imported from NCBI GEO — ${meta.geo_accession}`}
                    className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <Database className="h-3.5 w-3.5" />
                    GEO · {meta.geo_accession}
                  </a>
                );
              })()}
              <StatusBadge status={analysis.status} />
              <Link
                href={`/projects/${projectId}/setup?rerun=${analysisId}`}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Re-run
              </Link>
            </div>
          </div>
        </div>

        {/* ── Comparisons (primary results) ── */}
        <section>
          <SectionHeader
            title="Comparisons"
            subtitle={`${analysisComparisons.length} differential-expression comparison${analysisComparisons.length !== 1 ? 's' : ''} in this analysis`}
          />
          <ComparisonGrid
            projectId={projectId}
            analysisId={analysisId}
            comparisons={analysisComparisons}
            matrixDatasetId={matrixDataset?.id ?? null}
          />
        </section>

        {/* ── DEG patterns (expression trajectories across all conditions) ── */}
        {matrixDataset && degSources.length > 0 && (
          <section>
            <SectionHeader
              title="DEG patterns"
              subtitle="Significant DEGs (union across comparisons) clustered by expression trajectory across the analysis' conditions"
            />
            <DEGPatternsView
              matrixDatasetId={matrixDataset.id}
              degSources={degSources}
              sampleConditionMap={sampleConditionMap}
              label={analysis.name}
            />
          </section>
        )}

        {/* ── Sample structure (PCA / UMAP) ── */}
        <section>
          <SectionHeader
            title="Sample structure"
            subtitle="How samples relate to each other, computed from the normalized matrix"
            right={
              <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-secondary)' }}>
                {(['pca', 'umap'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStructureView(v)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
                    style={
                      structureView === v
                        ? { background: 'var(--sl-teal)', color: '#fff' }
                        : { background: 'transparent', color: 'var(--text-secondary)' }
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            }
          />
          {vstDataset ? (
            structureView === 'pca' ? (
              <PCAPlot dataset={vstDataset} metadataDataset={samplesDataset} />
            ) : (
              <UMAPPlot dataset={vstDataset} metadataDataset={samplesDataset} />
            )
          ) : (
            <div className="gl-card p-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No normalized matrix available for {structureView.toUpperCase()}.
            </div>
          )}
        </section>

        {/* ── Quality control ── */}
        <section>
          <SectionHeader title="Quality control" subtitle="Preprocessing & filtering applied before analysis" />
          <PreprocessingResults qcReport={qcReport} params={analysis.params} />
        </section>

        {/* ── Parameters (collapsible) ── */}
        <details className="gl-card p-5">
          <summary className="cursor-pointer font-display text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Analysis parameters
          </summary>
          <div className="mt-4">
            <AnalysisParams analysis={analysis} />
          </div>
        </details>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SelfServiceAnalysisStatus }) {
  const styles: Record<SelfServiceAnalysisStatus, string> = {
    [SelfServiceAnalysisStatus.PENDING]:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    [SelfServiceAnalysisStatus.RUNNING]:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    [SelfServiceAnalysisStatus.DONE]:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    [SelfServiceAnalysisStatus.FAILED]:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    [SelfServiceAnalysisStatus.CANCELLED]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
    { label: 'DEA method',           value: String(params.de_method ?? 'all') },
    { label: 'Design formula',       value: String(params.design ?? 'auto') },
    { label: 'FDR threshold',        value: String(params.fdr ?? 0.05) },
    { label: 'Fold-change',          value: `${(2 ** Number(params.min_log2fc ?? Math.log2(1.5))).toFixed(2)}×` },
    { label: 'Min reads / sample',   value: Number(params.min_reads ?? 100000).toLocaleString() },
    { label: 'Min genes / sample',   value: Number(params.min_genes ?? 500).toLocaleString() },
    { label: 'Min count / gene',     value: String(params.min_count ?? 10) },
    { label: 'Min replicates',       value: String(params.min_reps ?? 2) },
    { label: 'Threads',              value: String(params.threads ?? 1) },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
      <Link
        href={`/projects/${analysis.project_id}/setup?rerun=${analysis.id}`}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Re-run with new parameters
      </Link>
    </div>
  );
}
