'use client';

import React from 'react';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { Dataset, DatasetStatus } from '@/types';
import QCDashboard from '@/components/QCDashboard';
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

interface StepDataValidationProps {
  projectId: string;
  matrixDatasetId: string;
  samplesDatasetId: string;
  onContinue: () => void;
  onBack: () => void;
}

export default function StepDataValidation({
  projectId,
  matrixDatasetId,
  samplesDatasetId,
  onContinue,
  onBack,
}: StepDataValidationProps) {
  const { data: datasets = [] } = useProjectDatasets(projectId);

  const matrixDs  = datasets.find(d => d.id === matrixDatasetId);
  const samplesDs = datasets.find(d => d.id === samplesDatasetId);

  // Basic validation signals from dataset metadata
  const meta = matrixDs?.dataset_metadata as Record<string, unknown> | undefined;
  const geneCount    = (meta?.n_genes    as number | undefined) ?? (meta?.num_genes as number | undefined);
  const sampleCount  = (meta?.n_samples  as number | undefined) ?? (meta?.num_samples as number | undefined);
  const minLibSize   = (meta?.min_lib_size as number | undefined);

  const warnings: string[] = [];
  if (geneCount !== undefined && geneCount < 500) {
    warnings.push(`Low gene count detected: ${geneCount.toLocaleString()} genes. The pipeline expects ≥ 500 genes.`);
  }
  if (minLibSize !== undefined && minLibSize < 100_000) {
    warnings.push(`At least one sample has fewer than 100,000 reads (min: ${minLibSize.toLocaleString()}). Consider quality filtering.`);
  }
  if (sampleCount !== undefined && sampleCount < 4) {
    warnings.push(`Only ${sampleCount} samples detected. The pipeline typically needs ≥ 2 replicates per group.`);
  }

  const isMatrixReady = matrixDs?.status === DatasetStatus.READY;

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

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-control border border-warning/30 bg-warning-soft p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning-ink" />
            <p className="text-body-sm font-semibold text-warning-ink">Warnings detected</p>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-caption text-warning-ink pl-6">{w}</p>
          ))}
          <p className="text-caption text-warning-ink pl-6 pt-1">
            You can continue, but review these before interpreting results.
          </p>
        </div>
      )}

      {warnings.length === 0 && isMatrixReady && (
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
          className="inline-flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent shadow hover:bg-accent-hover"
        >
          Continue to Settings
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────
function DatasetStatusRow({ label, dataset }: { label: string; dataset: Dataset | undefined }) {
  if (!dataset) {
    return (
      <div className="flex items-center gap-3 rounded-control bg-surface-2 px-4 py-3">
        <div className="h-2 w-2 rounded-pill bg-gray-300" />
        <p className="text-body-sm text-muted">{label} — not uploaded</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    READY:      'bg-green-400',
    PROCESSING: 'bg-blue-400 animate-pulse',
    PENDING:    'bg-yellow-400 animate-pulse',
    FAILED:     'bg-red-400',
  };

  const statusLabels: Record<string, string> = {
    READY:      'Ready',
    PROCESSING: 'Processing…',
    PENDING:    'Queued',
    FAILED:     'Failed',
  };

  return (
    <div className="flex items-center gap-3 rounded-control bg-surface px-4 py-3">
      <div className={`h-2 w-2 rounded-pill shrink-0 ${statusColors[dataset.status] ?? 'bg-gray-300'}`} />
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-primary">{label}</p>
        <p className="text-caption text-muted truncate">{dataset.name} · {statusLabels[dataset.status] ?? dataset.status}</p>
      </div>
    </div>
  );
}
