'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, AlertCircle, RotateCcw, Database,
  GitCompare, GitBranch, Network, Activity, Settings2, ChevronRight, ArrowUpRight,
} from 'lucide-react';
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
import { useScientificModule } from '@/hooks/useAddOnModules';
import { scrollToId } from '@/utils/scrollToId';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-title tracking-[-0.3px]" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p className="mt-1 text-caption" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
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
  const [paramsOpen, setParamsOpen] = useState(false);
  const { unlocked: scienceUnlocked } = useScientificModule();
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<SelfServiceAnalysisStatus | null>(null);

  const { data: analysis, isLoading: analysisLoading, error: analysisError } = useAnalysis(analysisId);
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

  // Comparisons that belong to THIS analysis. The project summary aggregates
  // comparisons across every analysis, so we must scope them to this analysis'
  // own datasets: the recorded result_dataset_ids, plus any dataset tagged with
  // this analysis_id in its metadata (covers analyses whose result_dataset_ids
  // was never populated). Previously an empty result_dataset_ids fell back to
  // showing ALL project comparisons — which leaked other analyses' comparisons.
  const analysisComparisons = useMemo(() => {
    const allComparisons: ComparisonSummary[] = summary?.comparisons ?? [];
    if (!analysis) return allComparisons;
    const analysisDatasetIds = new Set<string>(analysis.result_dataset_ids ?? []);
    for (const d of datasets) {
      if (d.dataset_metadata?.analysis_id === analysisId) analysisDatasetIds.add(d.id);
    }
    return allComparisons.filter((c) => analysisDatasetIds.has(c.dataset_id));
  }, [analysis, summary?.comparisons, datasets, analysisId]);

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

  // Number of distinct conditions (x-axis of the DEG-patterns module)
  const conditionCount = useMemo(
    () => new Set(Object.values(sampleConditionMap ?? {})).size,
    [sampleConditionMap]
  );

  const patternsDataReady = Boolean(matrixDataset) && degSources.length > 0;
  const hasPatterns = patternsDataReady && scienceUnlocked;

  // ── Loading / error states ────────────────────────────────────────────────

  if (analysisLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-accent-ink" />
      </div>
    );
  }

  if (!analysis) {
    // Distinguish a genuinely missing analysis from an access / network failure —
    // labelling every error "not found" hides permission problems.
    const status = (analysisError as { response?: { status?: number } } | null)?.response?.status;
    const message =
      status === 403
        ? "You don't have access to this analysis."
        : status === 404 || !analysisError
          ? 'Analysis not found.'
          : 'Could not load this analysis. Please try again.';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-danger-ink mb-2" />
          <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
          <Link href={`/projects/${projectId}`} className="mt-3 inline-block text-body-sm text-accent-ink hover:underline">
            ← Back to project
          </Link>
        </div>
      </div>
    );
  }

  const projectName = summary?.project?.name ?? 'Project';

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--app-bg)' }}>
      <div className="page-container space-y-6">

        {/* Le titre de l'ecran vivait DANS une carte, precede d'un lien de
            retour et d'une tuile d'icone. Un ecran qui commence par une carte
            n'a pas de titre de page, il a une premiere carte. Le fil d'Ariane
            remplace le lien, PageHeader porte le titre, et les six tuiles de
            statistiques restent ce qu'elles sont : un bloc de donnees, pas une
            partie de l'en-tete.

            `titleVariant="name"` : le nom d'une analyse est saisi par
            l'utilisateur. */}
        <PageHeader
          title={analysis.name}
          titleVariant="name"
          crumbs={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}` },
            { label: analysis.name },
          ]}
          meta={
            <span className="text-caption text-muted">
              Created {new Date(analysis.created_at).toLocaleString('en-US')}
            </span>
          }
          actions={[
            {
              node: (
                <Link
                  href={`/projects/${projectId}/setup?rerun=${analysisId}`}
                  className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-caption font-medium text-secondary transition-colors hover:bg-hover"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Re-run
                </Link>
              ),
            },
          ]}
        />

        {/* ── Analysis facts ── */}
        <div className="gl-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <StatusBadge status={analysis.status} />
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
                    className="flex items-center gap-1 rounded-pill border border-accent-ring bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent-ink hover:bg-accent-soft"
                  >
                    <Database className="h-3.5 w-3.5" />
                    GEO · {meta.geo_accession}
                  </a>
                );
              })()}
            </div>
          </div>
          {/* Stat tiles — 1px dividers via gap-px over a border-coloured background */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}
          >
            <StatTile label="Comparisons" value={String(analysisComparisons.length)} />
            <StatTile label="Conditions" value={conditionCount > 0 ? String(conditionCount) : '—'} />
            <StatTile
              label="Samples kept"
              value={qcReport ? `${qcReport.samples_passed}/${qcReport.total_input_samples}` : '—'}
            />
            <StatTile
              label="Genes retained"
              value={qcReport ? qcReport.genes_after_filter.toLocaleString() : '—'}
            />
            <StatTile label="DEA method" value={String(analysis.params?.de_method ?? 'all')} mono />
            <StatTile label="FDR" value={String(analysis.params?.fdr ?? 0.05)} mono />
          </div>
        </div>

        {/* ── Analysis modules (card launcher) ── */}
        <section>
          <SectionHeader title="Analysis modules" subtitle="Jump to a result view" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard
              icon={GitCompare}
              title="Comparisons"
              description="Differential-expression results per contrast"
              metric={`${analysisComparisons.length} comparison${analysisComparisons.length !== 1 ? 's' : ''}`}
              targetId="module-comparisons"
            />
            <ModuleCard
              icon={GitBranch}
              title="DEG patterns"
              description="DEGs clustered by trajectory across conditions"
              metric={hasPatterns ? `${degSources.length} × ${conditionCount || '—'} conditions` : undefined}
              targetId="module-patterns"
              disabled={!hasPatterns}
              disabledHint={
                !scienceUnlocked ? 'Scientific tools add-on' : 'Needs an expression matrix'
              }
            />
            <ModuleCard
              icon={Network}
              title="Sample structure"
              description="PCA & UMAP of the normalized matrix"
              metric={vstDataset ? 'PCA · UMAP' : undefined}
              targetId="module-structure"
              disabled={!vstDataset}
              disabledHint="No normalized matrix"
            />
            <ModuleCard
              icon={Activity}
              title="Quality control"
              description="Preprocessing & filtering summary"
              metric={
                qcReport
                  ? `${Math.round((qcReport.samples_passed / Math.max(qcReport.total_input_samples, 1)) * 100)}% samples kept`
                  : undefined
              }
              targetId="module-qc"
              disabled={!qcReport}
              disabledHint="No QC report"
            />
            <ModuleCard
              icon={Settings2}
              title="Parameters"
              description="DEA method, thresholds & design"
              metric="View settings"
              targetId="module-params"
              onActivate={() => setParamsOpen(true)}
            />
          </div>
        </section>

        {/* ── Comparisons (primary results) ── */}
        <section id="module-comparisons" className="scroll-mt-6">
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
        {matrixDataset && degSources.length > 0 && scienceUnlocked && (
          <section id="module-patterns" className="scroll-mt-6">
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
        <section id="module-structure" className="scroll-mt-6">
          <SectionHeader
            title="Sample structure"
            subtitle="How samples relate to each other, computed from the normalized matrix"
            right={
              <div className="inline-flex rounded-control border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-secondary)' }}>
                {(['pca', 'umap'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStructureView(v)}
                    className="rounded-sm px-3 py-1.5 text-caption font-semibold uppercase tracking-wide transition-colors"
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
            <div className="gl-card p-16 text-center text-body-sm" style={{ color: 'var(--text-muted)' }}>
              No normalized matrix available for {structureView.toUpperCase()}.
            </div>
          )}
        </section>

        {/* ── Quality control ── */}
        <section id="module-qc" className="scroll-mt-6">
          <SectionHeader title="Quality control" subtitle="Preprocessing & filtering applied before analysis" />
          <PreprocessingResults qcReport={qcReport} params={analysis.params} />
        </section>

        {/* ── Parameters (collapsible) ── */}
        <details
          id="module-params"
          className="gl-card p-5 scroll-mt-6"
          open={paramsOpen}
          onToggle={(e) => setParamsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer font-display text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
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

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function StatTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3" style={{ background: 'var(--surface)' }}>
      <div className="text-micro font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className={cn('mt-1 text-body font-semibold', mono ? 'font-mono' : '')} style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function ModuleCard({
  icon: Icon, title, description, metric, targetId, disabled, disabledHint, onActivate,
}: {
  icon: IconType;
  title: string;
  description: string;
  metric?: string;
  targetId: string;
  disabled?: boolean;
  disabledHint?: string;
  onActivate?: () => void;
}) {
  const activate = () => {
    if (disabled) return;
    onActivate?.();
    scrollToId(targetId);
  };
  return (
    <button
      type="button"
      onClick={activate}
      disabled={disabled}
      aria-label={`Go to ${title}`}
      className="group gl-card gl-card-interactive text-left p-4 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        opacity: disabled ? 0.55 : 1,
        // @ts-expect-error CSS custom prop for focus ring colour
        '--tw-ring-color': 'var(--sl-teal)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-control" style={{ background: 'var(--sl-teal-light)' }}>
          <Icon className="h-4 w-4" style={{ color: 'var(--sl-teal-dark)' }} />
        </div>
        {!disabled && (
          <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <h3 className="mt-3 font-display text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mt-1 text-caption leading-snug" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      {(disabled ? disabledHint : metric) && (
        <div
          className="mt-2 inline-flex items-center gap-1 text-micro font-medium"
          style={{ color: disabled ? 'var(--text-muted)' : 'var(--sl-teal-dark)' }}
        >
          {!disabled && <ChevronRight className="h-3 w-3" />}
          {disabled ? disabledHint : metric}
        </div>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: SelfServiceAnalysisStatus }) {
  const styles: Record<SelfServiceAnalysisStatus, string> = {
    [SelfServiceAnalysisStatus.PENDING]:   'bg-warning-soft text-warning-ink',
    [SelfServiceAnalysisStatus.RUNNING]:   'bg-info-soft text-info-ink',
    [SelfServiceAnalysisStatus.DONE]:      'bg-success-soft text-success-ink',
    [SelfServiceAnalysisStatus.FAILED]:    'bg-danger-soft text-danger-ink',
    [SelfServiceAnalysisStatus.CANCELLED]: 'bg-surface-2 text-secondary',
  };
  const labels: Record<SelfServiceAnalysisStatus, string> = {
    [SelfServiceAnalysisStatus.PENDING]:   'Pending',
    [SelfServiceAnalysisStatus.RUNNING]:   'Running',
    [SelfServiceAnalysisStatus.DONE]:      'Done',
    [SelfServiceAnalysisStatus.FAILED]:    'Failed',
    [SelfServiceAnalysisStatus.CANCELLED]: 'Cancelled',
  };
  return (
    <span className={cn(
            'inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium',
            styles[status],
          )}>
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
      <div className="rounded-card overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)' }}
          >
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-caption font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
      <Link
        href={`/projects/${analysis.project_id}/setup?rerun=${analysis.id}`}
        className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-caption font-semibold text-on-accent hover:bg-accent-hover"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Re-run with new parameters
      </Link>
    </div>
  );
}
