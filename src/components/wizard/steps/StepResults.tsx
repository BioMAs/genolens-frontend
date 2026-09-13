'use client';

import React from 'react';
import Link from 'next/link';
import { useAnalysis } from '@/hooks/useAnalyses';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useProjectSummary } from '@/hooks/useProjectData';
import { CheckCircle, BarChart2, Grid, FlaskConical, ArrowLeft, RotateCcw } from 'lucide-react';
import { ClusteringConfig, EnrichmentConfig } from './StepAnalysisSettings';

interface StepResultsProps {
  projectId: string;
  analysisId: string;
  matrixDatasetId: string;
  clusteringConfig: ClusteringConfig;
  enrichmentConfig: EnrichmentConfig;
  onRunNew: () => void;
}

export default function StepResults({
  projectId,
  analysisId,
  matrixDatasetId,
  clusteringConfig,
  enrichmentConfig,
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

  const enrichmentParams = new URLSearchParams({
    databases: enrichmentConfig.databases === null ? 'all' : enrichmentConfig.databases.join(','),
    fdr:       String(enrichmentConfig.fdr),
  }).toString();

  // Find the first DEG result dataset for enrichment link
  const firstResultDs = resultDatasetIds.length > 0
    ? datasets.find(d => d.id === resultDatasetIds[0])
    : undefined;

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="rounded-card bg-linear-to-r from-green-50 to-emerald-50 border border-success/30 p-6 text-center">
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
          color="indigo"
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
          color="violet"
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
          icon={<FlaskConical className="h-6 w-6 text-teal-500" />}
          title="Pathway Enrichment"
          description="GO, KEGG & Reactome analysis"
          color="teal"
        >
          {firstResultDs ? (
            <>
              <Link
                href={`/projects/${projectId}/datasets/${firstResultDs.id}/enrichment?${enrichmentParams}`}
                className="mt-3 block w-full rounded-control bg-teal-600 px-3 py-2 text-center text-caption font-semibold text-on-accent hover:bg-teal-700"
              >
                Explore Enrichment →
              </Link>
              <p className="mt-2 text-micro text-muted text-center">
                {enrichmentConfig.databases === null ? 'All databases (anno.db)' : enrichmentConfig.databases.join(', ')} · FDR {enrichmentConfig.fdr}
              </p>
            </>
          ) : (
            <p className="mt-2 text-caption text-muted">Results are being indexed…</p>
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
  icon, title, description, badge, color = 'gray', children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const borderColors: Record<string, string> = {
    indigo: 'border-indigo-200',
    violet: 'border-violet-200',
    teal:   'border-teal-200',
    gray:   'border-gray-200',
  };

  return (
    <div className={`rounded-card border ${borderColors[color] ?? borderColors.gray}bg-surface p-4 shadow-sm flex flex-col`}>
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
