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
        <h2 className="text-xl font-bold text-gray-900">Data Validation & QC</h2>
        <p className="mt-1 text-sm text-gray-500">
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-amber-800">Warnings detected</p>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">{w}</p>
          ))}
          <p className="text-xs text-amber-600 pl-6 pt-1">
            You can continue, but review these before interpreting results.
          </p>
        </div>
      )}

      {warnings.length === 0 && isMatrixReady && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <p className="text-sm text-green-800 font-medium">All checks passed — your data looks good!</p>
        </div>
      )}

      {/* QC Dashboard */}
      {isMatrixReady ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Library Size & Quality Metrics</h3>
          <QCDashboard datasets={datasets} />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
          Processing matrix… QC charts will appear here once ready.
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
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
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <p className="text-sm text-gray-400">{label} — not uploaded</p>
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
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className={`h-2 w-2 rounded-full shrink-0 ${statusColors[dataset.status] ?? 'bg-gray-300'}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 truncate">{dataset.name} · {statusLabels[dataset.status] ?? dataset.status}</p>
      </div>
    </div>
  );
}
