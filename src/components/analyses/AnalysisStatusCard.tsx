'use client';

import React from 'react';
import Link from 'next/link';
import { Database } from 'lucide-react';
import { SelfServiceAnalysis, SelfServiceAnalysisStatus } from '@/types';
import { useDeleteAnalysis } from '@/hooks/useAnalyses';

interface Props {
  analysis: SelfServiceAnalysis;
  projectId: string;
  /** GEO accession when the analysis data was imported from NCBI GEO. */
  geoAccession?: string | null;
}

const STATUS_STYLES: Record<SelfServiceAnalysisStatus, string> = {
  [SelfServiceAnalysisStatus.PENDING]:   'bg-yellow-100 text-yellow-800',
  [SelfServiceAnalysisStatus.RUNNING]:   'bg-blue-100 text-blue-800',
  [SelfServiceAnalysisStatus.DONE]:      'bg-green-100 text-green-800',
  [SelfServiceAnalysisStatus.FAILED]:    'bg-red-100 text-red-800',
  [SelfServiceAnalysisStatus.CANCELLED]: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<SelfServiceAnalysisStatus, string> = {
  [SelfServiceAnalysisStatus.PENDING]:   'Pending',
  [SelfServiceAnalysisStatus.RUNNING]:   'Running',
  [SelfServiceAnalysisStatus.DONE]:      'Done',
  [SelfServiceAnalysisStatus.FAILED]:    'Failed',
  [SelfServiceAnalysisStatus.CANCELLED]: 'Cancelled',
};

export default function AnalysisStatusCard({ analysis, projectId, geoAccession }: Props) {
  const deleteAnalysis = useDeleteAnalysis(projectId);
  const isActive =
    analysis.status === SelfServiceAnalysisStatus.PENDING ||
    analysis.status === SelfServiceAnalysisStatus.RUNNING;

  const handleDelete = async () => {
    const label = isActive ? 'Cancel' : 'Delete';
    if (!confirm(`${label} analysis "${analysis.name}"?`)) return;
    await deleteAnalysis.mutateAsync(analysis.id);
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-primary text-body-sm">{analysis.name}</h3>
          <p className="text-caption text-muted mt-1">
            {new Date(analysis.created_at).toLocaleString('en-US')}
          </p>
          {geoAccession && (
            <a
              href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${geoAccession}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Data imported from NCBI GEO — ${geoAccession}`}
              className="mt-2 inline-flex items-center gap-1 rounded-pill border border-accent-ring bg-accent-soft px-2 py-0.5 text-micro font-medium text-accent-ink hover:bg-accent-soft"
            >
              <Database className="h-3 w-3" />
              GEO · {geoAccession}
            </a>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium ${STATUS_STYLES[analysis.status]}`}
        >
          {isActive && (
            <span className="mr-2 h-2 w-2 rounded-pill bg-current animate-pulse" />
          )}
          {STATUS_LABELS[analysis.status]}
        </span>
      </div>

      {/* Current step */}
      {analysis.current_step && isActive && (
        <p className="mt-2 text-caption text-secondary italic">
          Step: {analysis.current_step.replace(/_/g, ' ')}
        </p>
      )}

      {/* Error */}
      {analysis.status === SelfServiceAnalysisStatus.FAILED && analysis.error_message && (
        <details className="mt-2">
          <summary className="cursor-pointer text-caption text-red-600 font-medium">
            View error
          </summary>
          <pre className="mt-1 rounded-sm bg-red-50 p-2 text-caption text-red-700 overflow-auto max-h-40">
            {analysis.error_message}
          </pre>
        </details>
      )}

      {/* Progress log */}
      {analysis.progress_log && analysis.progress_log.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-caption text-secondary">
            Log ({analysis.progress_log.length} entries)
          </summary>
          <ul className="mt-1 space-y-1 text-caption text-secondary max-h-32 overflow-auto">
            {analysis.progress_log.map((entry, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US')}
                </span>
                <span>{entry.step}{entry.message ? ` — ${entry.message}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Results */}
      {analysis.status === SelfServiceAnalysisStatus.DONE && (
        <div className="mt-3">
          <Link
            href={`/projects/${projectId}/analyses/${analysis.id}`}
            className="inline-flex w-full items-center justify-center rounded-sm bg-accent px-3 py-2 text-caption font-semibold text-on-accent hover:bg-accent-hover shadow-sm"
          >
            View comparisons & results →
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleDelete}
          disabled={deleteAnalysis.isPending}
          className="text-caption text-muted hover:text-red-600 disabled:opacity-50"
        >
          {isActive ? 'Cancel' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
