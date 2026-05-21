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
      <div className="rounded-xl bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 p-6 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500 mb-3" />
        <h2 className="text-xl font-bold text-green-900">Analysis Complete!</h2>
        <p className="mt-1 text-sm text-green-700">
          Your multi-method analysis has finished. Explore your results below.
        </p>
        {analysis?.name && (
          <p className="mt-2 text-xs text-green-600 font-medium">{analysis.name}</p>
        )}
      </div>

      {/* Result cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* DEG Results */}
        <ResultCard
          icon={<BarChart2 className="h-6 w-6 text-indigo-500" />}
          title="Differential Expression"
          description={`${comparisons.length} comparison${comparisons.length !== 1 ? 's' : ''} generated`}
          badge={comparisons.length > 0 ? `${comparisons.reduce((a, c) => a + c.deg_total, 0).toLocaleString()} DEGs total` : undefined}
          color="indigo"
        >
          {comparisons.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {comparisons.slice(0, 4).map(c => (
                <Link
                  key={c.name}
                  href={`/projects/${projectId}/comparisons/${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between rounded-md bg-indigo-50 px-3 py-1.5 text-xs hover:bg-indigo-100"
                >
                  <span className="font-medium text-indigo-700 truncate">{c.name}</span>
                  <span className="ml-2 shrink-0 text-indigo-500">
                    ↑{c.deg_up} ↓{c.deg_down}
                  </span>
                </Link>
              ))}
              {comparisons.length > 4 && (
                <Link
                  href={`/projects/${projectId}`}
                  className="block text-center text-xs text-indigo-500 hover:underline"
                >
                  + {comparisons.length - 4} more — View all
                </Link>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">Results are being indexed…</p>
          )}
        </ResultCard>

        {/* Clustering */}
        <ResultCard
          icon={<Grid className="h-6 w-6 text-violet-500" />}
          title="Clustering"
          description="Interactive heatmap of expression patterns"
          color="violet"
        >
          <Link
            href={`/projects/${projectId}/datasets/${matrixDatasetId}/clustering?${clusteringParams}`}
            className="mt-3 block w-full rounded-lg bg-violet-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-violet-700"
          >
            Explore Clustering →
          </Link>
          <p className="mt-1.5 text-[10px] text-gray-400 text-center">
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
                className="mt-3 block w-full rounded-lg bg-teal-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-teal-700"
              >
                Explore Enrichment →
              </Link>
              <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                {enrichmentConfig.databases === null ? 'All databases (anno.db)' : enrichmentConfig.databases.join(', ')} · FDR {enrichmentConfig.fdr}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-gray-400">Results are being indexed…</p>
          )}
        </ResultCard>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <button
          type="button"
          onClick={onRunNew}
          className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
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
    <div className={`rounded-xl border ${borderColors[color] ?? borderColors.gray} bg-white p-4 shadow-sm flex flex-col`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          {badge && (
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
