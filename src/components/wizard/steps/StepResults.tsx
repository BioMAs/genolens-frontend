'use client';

import React from 'react';
import Link from 'next/link';
import { useAnalysis } from '@/hooks/useAnalyses';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useProjectSummary } from '@/hooks/useProjectData';
import { CheckCircle, BarChart2, Grid, FlaskConical, ArrowLeft, RotateCcw } from 'lucide-react';
import { ClusteringConfig } from './StepAnalysisSettings';
import { buildViewHref } from '@/components/comparison/comparisonRoutes';
import { DatasetType } from '@/types';
import { cn } from '@/lib/cn';

interface StepResultsProps {
  projectId: string;
  analysisId: string;
  matrixDatasetId: string;
  clusteringConfig: ClusteringConfig;
  onRunNew: () => void;
}

export default function StepResults({
  projectId,
  analysisId,
  matrixDatasetId,
  clusteringConfig,
  onRunNew,
}: StepResultsProps) {
  const { data: analysis } = useAnalysis(analysisId);
  const { data: summary } = useProjectSummary(projectId);
  const { data: datasets = [] } = useProjectDatasets(projectId);

  const comparisons = summary?.comparisons ?? [];
  const resultDatasetIds = analysis?.result_dataset_ids ?? [];

  // Build clustering & enrichment query params from config
  const clusteringParams = new URLSearchParams({
    top_n_genes:   String(clusteringConfig.top_n_genes),
    method:        clusteringConfig.method,
    metric:        clusteringConfig.metric,
    cluster_rows:  String(clusteringConfig.cluster_rows),
    cluster_cols:  String(clusteringConfig.cluster_cols),
  }).toString();

  /**
   * Where the enrichment can actually be read.
   *
   * The card used to open `/datasets/<result_dataset_ids[0]>/enrichment?databases=…&fdr=…`.
   * That id is the first comparison's DEG dataset — the ids alternate DEG, ENRICHMENT — while
   * the pathways are stored under the ENRICHMENT dataset, so the page found none; and it never
   * read the query string either. Each comparison's Understand screen does the DEG → enrichment
   * lookup itself, so the card links there, one entry per comparison that has enrichment.
   */
  const enrichedComparisons = resultDatasetIds
    .map(id => datasets.find(d => d.id === id))
    .filter(d => d?.type === DatasetType.ENRICHMENT)
    .map(d => d!.dataset_metadata?.comparison_name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  // What the analysis ran with, not the wizard's local state. Absent before the field was sent:
  // the R script's 0.05 applied.
  const termFdr = analysis?.params?.enrichment_fdr ?? 0.05;

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="rounded-card bg-success-soft p-6 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-success-ink mb-3" />
        <h2 className="text-heading text-success-ink">Analysis Complete!</h2>
        <p className="mt-1 text-body-sm text-success-ink">
          Your multi-method analysis has finished. Explore your results below.
        </p>
        {analysis?.name && (
          <p className="mt-2 text-caption text-success-ink font-medium">{analysis.name}</p>
        )}
      </div>

      {/* Result cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* DEG Results */}
        <ResultCard
          icon={<BarChart2 className="h-6 w-6 text-accent-ink" />}
          title="Differential Expression"
          description={`${comparisons.length} comparison${comparisons.length !== 1 ? 's' : ''} generated`}
          badge={comparisons.length > 0 ? `${comparisons.reduce((a, c) => a + c.deg_total, 0).toLocaleString()} DEGs total` : undefined}
        >
          {comparisons.length > 0 ? (
            <div className="mt-3 space-y-2">
              {comparisons.slice(0, 4).map(c => (
                <Link
                  key={c.name}
                  href={`/projects/${projectId}/comparisons/${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between rounded-sm bg-accent-soft px-3 py-1.5 text-caption hover:bg-accent-soft"
                >
                  <span className="font-medium text-accent-ink truncate">{c.name}</span>
                  <span className="ml-2 shrink-0 text-accent-ink">
                    ↑{c.deg_up} ↓{c.deg_down}
                  </span>
                </Link>
              ))}
              {comparisons.length > 4 && (
                <Link
                  href={`/projects/${projectId}`}
                  className="block text-center text-caption text-accent-ink hover:underline"
                >
                  + {comparisons.length - 4} more — View all
                </Link>
              )}
            </div>
          ) : (
            <p className="mt-2 text-caption text-muted">Results are being indexed…</p>
          )}
        </ResultCard>

        {/* Clustering */}
        <ResultCard
          icon={<Grid className="h-6 w-6 text-accent-ink" />}
          title="Clustering"
          description="Interactive heatmap of expression patterns"
        >
          <Link
            href={`/projects/${projectId}/datasets/${matrixDatasetId}/clustering?${clusteringParams}`}
            className="mt-3 block w-full rounded-control bg-accent px-3 py-2 text-center text-caption font-semibold text-on-accent hover:bg-accent-hover"
          >
            Explore Clustering →
          </Link>
          <p className="mt-2 text-micro text-muted text-center">
            {clusteringConfig.method} · {clusteringConfig.metric} · top {clusteringConfig.top_n_genes} genes
          </p>
        </ResultCard>

        {/* Enrichment */}
        <ResultCard
          icon={<FlaskConical className="h-6 w-6 text-accent-ink" />}
          title="Pathway Enrichment"
          description="GO, KEGG & Reactome analysis"
        >
          {enrichedComparisons.length > 0 ? (
            <>
              <div className="mt-3 space-y-2">
                {enrichedComparisons.slice(0, 4).map(name => (
                  <Link
                    key={name}
                    href={buildViewHref(
                      `/projects/${projectId}/comparisons/${encodeURIComponent(name)}`,
                      'comprendre',
                      'enrichment',
                    )}
                    className="flex items-center justify-between rounded-sm bg-accent-soft px-3 py-1.5 text-caption hover:bg-accent-soft"
                  >
                    <span className="font-medium text-accent-ink truncate">{name}</span>
                    <span className="ml-2 shrink-0 text-accent-ink">Explore Enrichment →</span>
                  </Link>
                ))}
                {enrichedComparisons.length > 4 && (
                  <Link
                    href={`/projects/${projectId}`}
                    className="block text-center text-caption text-accent-ink hover:underline"
                  >
                    + {enrichedComparisons.length - 4} more — View all
                  </Link>
                )}
              </div>
              <p className="mt-2 text-micro text-muted text-center">
                Terms kept at adj. p-value &lt; {termFdr}
              </p>
            </>
          ) : (
            <p className="mt-2 text-caption text-muted">
              No enrichment results yet. Once indexed, they appear on each comparison&apos;s Understand screen.
            </p>
          )}
        </ResultCard>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-subtle">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-body-sm text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <button
          type="button"
          onClick={onRunNew}
          className="flex items-center gap-2 rounded-control border border-accent-ring bg-accent-soft px-4 py-2 text-body-sm font-medium text-accent-ink hover:bg-accent-soft"
        >
          <RotateCcw className="h-4 w-4" /> Run New Analysis
        </button>
      </div>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function ResultCard({
  icon, title, description, badge, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  /**
   * SIXIEME concatenation sans espace du produit :
   * `${borderColors[...]}bg-surface` fusionnait la couleur de bordure avec le
   * fond. Les DEUX etaient perdus — la carte n'avait ni fond de surface, ni
   * couleur de filet, et `border` seul retombait sur `currentColor`.
   *
   * Les trois teintes etaient par ailleurs de la palette Tailwind brute, et
   * `indigo` y servait de couleur decorative alors que la regle le reserve a
   * l'accent interactif. Une carte de resultat n'est pas cliquable : ces
   * filets n'ont aucune raison d'etre colores, et la regle L1 dit deja que
   * grouper n'est pas une raison de border.
   */
  return (
    <div className={cn('gl-card p-4 flex flex-col')}>
      <div className="flex items-start gap-3">
        <div className="rounded-control bg-surface-2 p-2">{icon}</div>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-primary">{title}</p>
          <p className="text-caption text-secondary mt-1">{description}</p>
          {badge && (
            <span className="mt-1 inline-block rounded-pill bg-surface-2 px-2 py-0.5 text-micro text-secondary">
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
