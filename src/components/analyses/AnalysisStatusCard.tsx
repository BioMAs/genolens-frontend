'use client';

import React from 'react';
import Link from 'next/link';
import { SelfServiceAnalysis, SelfServiceAnalysisStatus } from '@/types';
import { useDeleteAnalysis } from '@/hooks/useAnalyses';

interface Props {
  analysis: SelfServiceAnalysis;
  projectId: string;
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

export default function AnalysisStatusCard({ analysis, projectId }: Props) {
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{analysis.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(analysis.created_at).toLocaleString('en-US')}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[analysis.status]}`}
        >
          {isActive && (
            <span className="mr-1.5 h-2 w-2 rounded-full bg-current animate-pulse" />
          )}
          {STATUS_LABELS[analysis.status]}
        </span>
      </div>

      {/* Current step */}
      {analysis.current_step && isActive && (
        <p className="mt-2 text-xs text-gray-500 italic">
          Step: {analysis.current_step.replace(/_/g, ' ')}
        </p>
      )}

      {/* Error */}
      {analysis.status === SelfServiceAnalysisStatus.FAILED && analysis.error_message && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-600 font-medium">
            View error
          </summary>
          <pre className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700 overflow-auto max-h-40">
            {analysis.error_message}
          </pre>
        </details>
      )}

      {/* Progress log */}
      {analysis.progress_log && analysis.progress_log.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-500">
            Log ({analysis.progress_log.length} entries)
          </summary>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600 max-h-32 overflow-auto">
            {analysis.progress_log.map((entry, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 shrink-0">
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
            className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
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
          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          {isActive ? 'Cancel' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
