'use client';

import React from 'react';
import Link from 'next/link';
import { Database } from 'lucide-react';
import { SelfServiceAnalysis, SelfServiceAnalysisStatus } from '@/types';
import { useDeleteAnalysis } from '@/hooks/useAnalyses';
import CancelAnalysisButton from '@/components/analyses/CancelAnalysisButton';
import { cn } from '@/lib/cn';

interface Props {
  analysis: SelfServiceAnalysis;
  projectId: string;
  /** GEO accession when the analysis data was imported from NCBI GEO. */
  geoAccession?: string | null;
}

const STATUS_STYLES: Record<SelfServiceAnalysisStatus, string> = {
  [SelfServiceAnalysisStatus.PENDING]:   'bg-warning-soft text-warning-ink',
  [SelfServiceAnalysisStatus.RUNNING]:   'bg-info-soft text-info-ink',
  [SelfServiceAnalysisStatus.DONE]:      'bg-success-soft text-success-ink',
  [SelfServiceAnalysisStatus.FAILED]:    'bg-danger-soft text-danger-ink',
  [SelfServiceAnalysisStatus.CANCELLED]: 'bg-surface-2 text-secondary',
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

  const handleDelete = () => {
    if (!confirm(`Delete analysis "${analysis.name}"?`)) return;
    deleteAnalysis.mutate(analysis.id);
  };

  return (
    <div className="rounded-card bg-surface p-4 shadow-sm">
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
          className={cn(
            'inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium',
            STATUS_STYLES[analysis.status],
          )}
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
          <summary className="cursor-pointer text-caption text-danger-ink font-medium">
            View error
          </summary>
          <pre className="mt-1 rounded-sm bg-danger-soft p-2 text-caption text-danger-ink overflow-auto max-h-40">
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
      {/* Une analyse en cours s'annule (statut CANCELLED, tâche révoquée) ;
          elle ne se supprime qu'une fois terminée. */}
      <div className="mt-3 flex justify-end">
        {isActive ? (
          <CancelAnalysisButton
            analysisId={analysis.id}
            analysisName={analysis.name}
            className="text-caption text-muted hover:text-danger-ink-hover"
          />
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteAnalysis.isPending}
              className="text-caption text-muted hover:text-danger-ink-hover disabled:opacity-50"
            >
              {deleteAnalysis.isPending ? 'Deleting…' : 'Delete'}
            </button>
            {deleteAnalysis.isError && (
              <p role="alert" className="text-caption text-danger-ink">
                Could not delete the analysis. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
