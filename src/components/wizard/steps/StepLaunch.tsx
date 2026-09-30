'use client';

import React, { useEffect, useState } from 'react';
import { useCreateAnalysis, useAnalysis } from '@/hooks/useAnalyses';
import CancelAnalysisButton from '@/components/analyses/CancelAnalysisButton';
import AnalysisQuotaNotice, {
  useAnalysisQuotaBlocked,
} from '@/components/analyses/AnalysisQuotaNotice';
import { useProjectDatasets } from '@/hooks/useProjectData';
import {
  SelfServiceAnalysisStatus,
  OmicsDataType,
} from '@/types';
import { AnalysisParams as AP } from '@/types';
import {
  Play, X, CheckCircle, AlertCircle, ChevronRight, Loader,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { analysisStepLabel } from '@/utils/analysisSteps';

interface StepLaunchProps {
  projectId: string;
  analysisName: string;
  dataType: OmicsDataType;
  matrixDatasetId: string;
  samplesDatasetId: string;
  contrastsDatasetId: string;
  /** Sample-sheet column the comparisons were built on; null lets the pipeline auto-detect. */
  conditionColumn?: string | null;
  deseq2Params: AP;
  /** ID of an already-launched analysis (e.g. when resuming) */
  analysisId: string | null;
  onLaunched: (analysisId: string) => void;
  onComplete: (analysisId: string) => void;
  onBack: () => void;
}

export default function StepLaunch({
  projectId,
  analysisName,
  dataType,
  matrixDatasetId,
  samplesDatasetId,
  contrastsDatasetId,
  conditionColumn = null,
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

  // Le quota se depense ici, et nulle part ailleurs dans le wizard. Une
  // analyse coute une unite, quel que soit son nombre de contrastes.
  const quotaBlocked = useAnalysisQuotaBlocked();

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
        params:                  { ...deseq2Params, condition_column: conditionColumn },
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

  const isRunning =
    analysis?.status === SelfServiceAnalysisStatus.PENDING ||
    analysis?.status === SelfServiceAnalysisStatus.RUNNING;
  const isFailed  = analysis?.status === SelfServiceAnalysisStatus.FAILED;
  const isDone    = analysis?.status === SelfServiceAnalysisStatus.DONE;
  const isCancelled = analysis?.status === SelfServiceAnalysisStatus.CANCELLED;

  const progressLog = analysis?.progress_log ?? [];
  const currentStep = analysis?.current_step;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading text-primary">Launch Analysis</h2>
        <p className="mt-1 text-body-sm text-secondary">
          Review your configuration and launch the multi-method differential expression analysis.
        </p>
      </div>

      {/* Rappel de quota — juste avant l'action qui le depense */}
      {!analysisId && <AnalysisQuotaNotice />}

      {/* Summary card */}
      {!analysisId && (
        <div className="rounded-card bg-surface-2 divide-y divide-subtle">
          <div className="px-4 py-3">
            <p className="text-caption font-semibold text-secondary uppercase tracking-wide mb-2">Files</p>
            <div className="space-y-1 text-body-sm">
              <SummaryRow label="Count Matrix"    value={matrixDs?.name    ?? matrixDatasetId} />
              <SummaryRow label="Sample Metadata" value={samplesDs?.name   ?? samplesDatasetId} />
              <SummaryRow label="Contrast File"   value={contrastsDs?.name ?? contrastsDatasetId} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-caption font-semibold text-secondary uppercase tracking-wide mb-2">Analysis Settings</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-body-sm">
              <SummaryRow label="Design"    value={deseq2Params.design} />
              <SummaryRow label="FDR"       value={String(deseq2Params.fdr)} />
              <SummaryRow label="Fold-change" value={`${(2 ** deseq2Params.min_log2fc).toFixed(2)}×`} />
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-caption font-semibold text-secondary uppercase tracking-wide mb-1">Analysis Name</p>
            <p className="text-body-sm font-medium text-primary">{analysisName}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {launchError && (
        <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-soft p-4">
          <AlertCircle className="h-5 w-5 text-danger-ink shrink-0 mt-1" />
          <div>
            <p className="text-body-sm font-semibold text-danger-ink">Launch failed</p>
            <p className="text-caption text-danger-ink mt-1">{launchError}</p>
          </div>
        </div>
      )}

      {/* Progress section */}
      {analysisId && (
        <div className="rounded-card bg-surface overflow-hidden">
          {/* Status header */}
          <div className={cn(
                 'px-4 py-3 flex items-center gap-3',
                 isDone ? 'bg-success-soft border-b border-success/30'
                 : isFailed ? 'bg-danger-soft border-b border-danger/30'
                 : isCancelled ? 'bg-surface-2 border-b border-subtle'
                 : 'bg-info-soft border-b border-info/30',
               )}>
            {isDone   && <CheckCircle className="h-5 w-5 text-success-ink" />}
            {isFailed && <AlertCircle className="h-5 w-5 text-danger-ink" />}
            {isCancelled && <X className="h-5 w-5 text-secondary" />}
            {isRunning && <Loader className="h-5 w-5 text-info-ink animate-spin" />}
            <div>
              <p className={cn(
                   'text-body-sm font-semibold',
                   isDone ? 'text-success-ink'
                   : isFailed ? 'text-danger-ink'
                   : isCancelled ? 'text-secondary'
                   : 'text-info-ink',
                 )}>
                {isDone   ? 'Analysis complete!'
                : isFailed ? 'Analysis failed'
                : isCancelled ? 'Analysis cancelled — no quota was used'
                : currentStep
                  ? analysisStepLabel(currentStep)
                  : 'Analysis queued…'}
              </p>
              {isFailed && analysis?.error_message && (
                <p className="text-caption text-danger-ink mt-1">{analysis.error_message}</p>
              )}
            </div>
            {isRunning && analysisId && (
              <div className="ml-auto">
                <CancelAnalysisButton
                  analysisId={analysisId}
                  showIcon
                  className="rounded-sm border border-danger/30 px-2 py-1 text-caption text-danger-ink hover:bg-danger-soft"
                />
              </div>
            )}
          </div>

          {/* Progress log */}
          {progressLog.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-caption font-medium text-secondary mb-2">Progress log</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {progressLog.map((entry, i) => (
                  <li key={i} className="flex items-start gap-2 text-caption">
                    <span className="text-muted shrink-0 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
                    </span>
                    <span className={cn(
                            i === progressLog.length - 1 && isRunning ? 'text-info-ink font-medium' : 'text-secondary',
                          )}>
                      {analysisStepLabel(entry.step)}
                      {entry.message ? ` — ${entry.message}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Indeterminate progress bar */}
          {isRunning && (
            <div className="h-1 bg-info-soft">
              <div className="h-full bg-info animate-pulse w-full" />
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
            className="rounded-control border border-strong px-4 py-2 text-body-sm font-medium text-primary hover:bg-hover"
          >
            ← Back
          </button>
        )}

        {!analysisId && (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={createAnalysis.isPending || quotaBlocked}
            title={
              quotaBlocked ? 'No analysis left this month. Upgrade to continue.' : undefined
            }
            className="ml-auto inline-flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent shadow hover:bg-accent-hover disabled:opacity-40"
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
            className="ml-auto inline-flex items-center gap-2 rounded-control bg-success px-5 py-2.5 text-body-sm font-semibold text-on-accent shadow hover:bg-success-hover"
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
    <div className="flex items-baseline gap-2">
      <span className="text-secondary shrink-0">{label}:</span>
      <span className="font-medium text-primary truncate">{value}</span>
    </div>
  );
}
