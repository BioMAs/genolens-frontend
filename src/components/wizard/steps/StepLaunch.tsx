'use client';

import React, { useEffect, useState } from 'react';
import { useCreateAnalysis, useAnalysis } from '@/hooks/useAnalyses';
import { useProjectDatasets } from '@/hooks/useProjectData';
import {
  SelfServiceAnalysisStatus,
  OmicsDataType,
} from '@/types';
import { AnalysisParams as AP } from '@/types';
import {
  Play, X, CheckCircle, AlertCircle, ChevronRight, Loader,
} from 'lucide-react';

interface StepLaunchProps {
  projectId: string;
  analysisName: string;
  dataType: OmicsDataType;
  matrixDatasetId: string;
  samplesDatasetId: string;
  contrastsDatasetId: string;
  deseq2Params: AP;
  /** ID of an already-launched analysis (e.g. when resuming) */
  analysisId: string | null;
  onLaunched: (analysisId: string) => void;
  onComplete: (analysisId: string) => void;
  onBack: () => void;
}

const STEP_LABELS: Record<string, string> = {
  loading_data:       'Loading data',
  validating:         'Validating inputs',
  normalizing:        'Normalizing counts',
  running_deseq2:     'Running analysis',
  filtering_results:  'Filtering results',
  saving_results:     'Saving results',
  done:               'Completed',
};

export default function StepLaunch({
  projectId,
  analysisName,
  dataType,
  matrixDatasetId,
  samplesDatasetId,
  contrastsDatasetId,
  deseq2Params,
  analysisId: initialAnalysisId,
  onLaunched,
  onComplete,
  onBack,
}: StepLaunchProps) {
  const { data: datasets = [] } = useProjectDatasets(projectId);
  const createAnalysis = useCreateAnalysis();

  const [analysisId, setAnalysisId] = useState<string | null>(initialAnalysisId);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const matrixDs    = datasets.find(d => d.id === matrixDatasetId);
  const samplesDs   = datasets.find(d => d.id === samplesDatasetId);
  const contrastsDs = datasets.find(d => d.id === contrastsDatasetId);

  // Poll the analysis once launched
  const { data: analysis } = useAnalysis(analysisId ?? '', !!analysisId);

  // Auto-advance when done
  useEffect(() => {
    if (analysis?.status === SelfServiceAnalysisStatus.DONE && analysisId) {
      onComplete(analysisId);
    }
  }, [analysis?.status, analysisId, onComplete]);

  const handleLaunch = async () => {
    setLaunchError(null);
    try {
      const result = await createAnalysis.mutateAsync({
        project_id:              projectId,
        name:                    analysisName,
        data_type:               dataType,
        matrix_dataset_id:       matrixDatasetId,
        samples_dataset_id:      samplesDatasetId,
        comparisons_dataset_id:  contrastsDatasetId,
        params:                  deseq2Params,
      });
      setAnalysisId(result.id);
      onLaunched(result.id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to launch analysis. Please try again.';
      setLaunchError(msg);
    }
  };

  const handleCancel = async () => {
    if (!analysisId || !confirm('Cancel this analysis?')) return;
    try {
      // The delete endpoint acts as cancel for running jobs
      await fetch(`/api/v2/analyses/${analysisId}`, { method: 'DELETE' });
    } catch {
      // Ignore cancel errors
    }
  };

  const isRunning =
    analysis?.status === SelfServiceAnalysisStatus.PENDING ||
    analysis?.status === SelfServiceAnalysisStatus.RUNNING;
  const isFailed  = analysis?.status === SelfServiceAnalysisStatus.FAILED;
  const isDone    = analysis?.status === SelfServiceAnalysisStatus.DONE;

  const progressLog = analysis?.progress_log ?? [];
  const currentStep = analysis?.current_step;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Launch Analysis</h2>
        <p className="mt-1 text-sm text-gray-500">
          Review your configuration and launch the multi-method differential expression analysis.
        </p>
      </div>

      {/* Summary card */}
      {!analysisId && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Files</p>
            <div className="space-y-1 text-sm">
              <SummaryRow label="Count Matrix"    value={matrixDs?.name    ?? matrixDatasetId} />
              <SummaryRow label="Sample Metadata" value={samplesDs?.name   ?? samplesDatasetId} />
              <SummaryRow label="Contrast File"   value={contrastsDs?.name ?? contrastsDatasetId} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Analysis Settings</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <SummaryRow label="Design"    value={deseq2Params.design} />
              <SummaryRow label="FDR"       value={String(deseq2Params.fdr)} />
              <SummaryRow label="log2FC" value={String(deseq2Params.min_log2fc)} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Analysis Name</p>
            <p className="text-sm font-medium text-gray-800">{analysisName}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {launchError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Launch failed</p>
            <p className="text-xs text-red-600 mt-0.5">{launchError}</p>
          </div>
        </div>
      )}

      {/* Progress section */}
      {analysisId && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Status header */}
          <div className={`px-4 py-3 flex items-center gap-3 ${
            isDone ? 'bg-green-50 border-b border-green-100'
            : isFailed ? 'bg-red-50 border-b border-red-100'
            : 'bg-blue-50 border-b border-blue-100'
          }`}>
            {isDone   && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isFailed && <AlertCircle className="h-5 w-5 text-red-500" />}
            {isRunning && <Loader className="h-5 w-5 text-blue-400 animate-spin" />}
            <div>
              <p className={`text-sm font-semibold ${isDone ? 'text-green-800' : isFailed ? 'text-red-800' : 'text-blue-800'}`}>
                {isDone   ? 'Analysis complete!'
                : isFailed ? 'Analysis failed'
                : currentStep
                  ? (STEP_LABELS[currentStep] ?? currentStep.replace(/_/g, ' '))
                  : 'Analysis queued…'}
              </p>
              {analysis?.error_message && (
                <p className="text-xs text-red-600 mt-0.5">{analysis.error_message}</p>
              )}
            </div>
            {isRunning && (
              <button
                type="button"
                onClick={handleCancel}
                className="ml-auto flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            )}
          </div>

          {/* Progress log */}
          {progressLog.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Progress log</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {progressLog.map((entry, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 shrink-0 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
                    </span>
                    <span className={`${i === progressLog.length - 1 && isRunning ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      {entry.step.replace(/_/g, ' ')}
                      {entry.message ? ` — ${entry.message}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Indeterminate progress bar */}
          {isRunning && (
            <div className="h-1 bg-blue-100">
              <div className="h-full bg-blue-400 animate-pulse w-full" />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        {!analysisId && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back
          </button>
        )}

        {!analysisId && (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={createAnalysis.isPending}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
          >
            {createAnalysis.isPending ? (
              <><Loader className="h-4 w-4 animate-spin" /> Launching…</>
            ) : (
              <><Play className="h-4 w-4" /> Launch Analysis</>
            )}
          </button>
        )}

        {isDone && (
          <button
            type="button"
            onClick={() => analysisId && onComplete(analysisId)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700"
          >
            View Results
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="font-medium text-gray-800 truncate">{value}</span>
    </div>
  );
}
