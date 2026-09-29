'use client';

import React, { useMemo } from 'react';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useDatasetQuery } from '@/hooks/useDatasets';
import { Dataset, DatasetStatus } from '@/types';
import QCDashboard from '@/components/QCDashboard';
import { AlertTriangle, CheckCircle, ChevronRight, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buildValidationReport, ValidationIssue } from '@/lib/dataValidation';

interface StepDataValidationProps {
  projectId: string;
  matrixDatasetId: string;
  samplesDatasetId: string;
  /** Grouping column picked in the contrast builder; null for an uploaded contrast file. */
  conditionColumn?: string | null;
  onContinue: () => void;
  onBack: () => void;
}

export default function StepDataValidation({
  projectId,
  matrixDatasetId,
  samplesDatasetId,
  conditionColumn = null,
  onContinue,
  onBack,
}: StepDataValidationProps) {
  const { data: datasets = [] } = useProjectDatasets(projectId);

  const matrixDs  = datasets.find(d => d.id === matrixDatasetId);
  const samplesDs = datasets.find(d => d.id === samplesDatasetId);

  const isMatrixReady  = matrixDs?.status === DatasetStatus.READY;
  const isSamplesReady = samplesDs?.status === DatasetStatus.READY;

  // Same query (and cache entry) as the ContrastBuilder in the next step.
  const { data: sampleSheet, isError: sampleSheetError } =
    useDatasetQuery(samplesDatasetId, 10000, isSamplesReady);

  const report = useMemo(
    () => buildValidationReport({
      matrixMetadata: matrixDs?.dataset_metadata,
      sampleRows: sampleSheet?.data,
      sampleColumns: sampleSheet?.columns,
      conditionColumn,
    }),
    [matrixDs?.dataset_metadata, sampleSheet, conditionColumn],
  );

  const bothReady = isMatrixReady && isSamplesReady;
  const warnings = report.issues.filter(i => !i.blocking);
  const errors   = report.issues.filter(i => i.blocking);
  const allPassed = bothReady && report.complete && report.issues.length === 0;
  const metricsUnavailable = bothReady && (sampleSheetError || report.matrixMetricsMissing);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading text-primary">Data Validation & QC</h2>
        <p className="mt-1 text-body-sm text-secondary">
          Review the quality metrics for your uploaded files before running the analysis.
        </p>
      </div>

      {/* Dataset status summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DatasetStatusRow label="Count Matrix"   dataset={matrixDs} />
        <DatasetStatusRow label="Sample Metadata" dataset={samplesDs} />
      </div>

      {/* Blocking problems */}
      {errors.length > 0 && (
        <div role="alert" className="rounded-control border border-danger/30 bg-danger-soft p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-danger-ink" />
            <p className="text-body-sm font-semibold text-danger-ink">Fix this before continuing</p>
          </div>
          <IssueList issues={errors} tone="text-danger-ink" />
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-control border border-warning/30 bg-warning-soft p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-ink" />
            <p className="text-body-sm font-semibold text-warning-ink">
              {warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`}
            </p>
          </div>
          <IssueList issues={warnings} tone="text-warning-ink" />
          <p className="text-caption text-warning-ink pl-6">
            You can continue, but review these before interpreting results.
          </p>
        </div>
      )}

      {metricsUnavailable && (
        <div className="flex items-start gap-2 rounded-control border border-info/30 bg-info-soft px-4 py-3">
          <Info className="mt-1 h-4 w-4 shrink-0 text-info-ink" />
          <p className="text-body-sm text-info-ink">
            {sampleSheetError
              ? 'The sample sheet could not be read, so it was not checked against the count matrix.'
              : 'Some checks could not run: per-sample read and gene counts are missing for this ' +
                'count matrix (it was probably uploaded before these checks existed). Upload it ' +
                'again to run them.'}
          </p>
        </div>
      )}

      {allPassed && (
        <div className="flex items-center gap-2 rounded-control border border-success/30 bg-success-soft px-4 py-3">
          <CheckCircle className="h-4 w-4 text-success-ink" />
          <p className="text-body-sm text-success-ink font-medium">All checks passed — your data looks good!</p>
        </div>
      )}

      {/* QC Dashboard */}
      {isMatrixReady ? (
        <div className="rounded-card bg-surface p-4 shadow-sm">
          <h3 className="mb-4 text-body-sm font-semibold text-primary">Library Size & Quality Metrics</h3>
          <QCDashboard datasets={datasets} />
        </div>
      ) : (
        <div className="rounded-card bg-surface-2 p-8 text-center text-body-sm text-muted">
          Processing matrix… QC charts will appear here once ready.
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-control border border-strong px-4 py-2 text-body-sm font-medium text-primary hover:bg-hover"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={report.blocking}
          title={report.blocking ? 'Fix the sample mismatch above to continue' : undefined}
          className="inline-flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent shadow hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent"
        >
          Continue to Settings
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function IssueList({ issues, tone }: { issues: ValidationIssue[]; tone: string }) {
  return (
    <ul className="space-y-2 pl-6">
      {issues.map(issue => (
        <li key={issue.id} data-issue={issue.id}>
          <p className={cn('text-body-sm font-medium', tone)}>{issue.title}</p>
          <p className={cn('text-caption', tone)}>{issue.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function DatasetStatusRow({ label, dataset }: { label: string; dataset: Dataset | undefined }) {
  if (!dataset) {
    return (
      <div className="flex items-center gap-3 rounded-control bg-surface-2 px-4 py-3">
        <div className="h-2 w-2 rounded-pill bg-hover" />
        <p className="text-body-sm text-muted">{label} — not uploaded</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    READY:      'bg-success',
    PROCESSING: 'bg-info animate-pulse',
    PENDING:    'bg-warning animate-pulse',
    FAILED:     'bg-danger',
  };

  const statusLabels: Record<string, string> = {
    READY:      'Ready',
    PROCESSING: 'Processing…',
    PENDING:    'Queued',
    FAILED:     'Failed',
  };

  return (
    <div className="flex items-center gap-3 rounded-control bg-surface px-4 py-3">
      <div className={cn(
             'h-2 w-2 rounded-pill shrink-0',
             statusColors[dataset.status] ?? 'bg-hover',
           )} />
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-primary">{label}</p>
        <p className="text-caption text-muted truncate">{dataset.name} · {statusLabels[dataset.status] ?? dataset.status}</p>
      </div>
    </div>
  );
}
