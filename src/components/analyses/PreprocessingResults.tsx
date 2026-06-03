'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Users, Dna } from 'lucide-react';

export interface QCReport {
  total_input_samples: number;
  samples_passed: number;
  samples_removed: number;
  removed_sample_ids: string[];
  genes_before_filter: number;
  genes_after_filter: number;
  genes_removed: number;
  min_reads_threshold: number;
  min_genes_threshold: number;
  min_count_threshold: number;
  min_reps_threshold: number;
  design_formula: string;
  has_batch_correction: boolean;
}

interface PreprocessingResultsProps {
  qcReport: QCReport | null;
}

export default function PreprocessingResults({ qcReport }: PreprocessingResultsProps) {
  if (!qcReport) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-yellow-400 mb-2" />
        <p className="text-sm text-yellow-700 font-medium">
          QC report not available for this analysis.
        </p>
        <p className="text-xs text-yellow-600 mt-1">
          Re-run the analysis to generate preprocessing metrics.
        </p>
      </div>
    );
  }

  const filterPct = qcReport.genes_before_filter > 0
    ? ((qcReport.genes_removed / qcReport.genes_before_filter) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          label="Samples Input"
          value={qcReport.total_input_samples}
          bg="bg-indigo-50"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          label="Samples Passed"
          value={qcReport.samples_passed}
          bg="bg-green-50"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          label="Samples Removed"
          value={qcReport.samples_removed}
          bg="bg-red-50"
        />
        <StatCard
          icon={<Dna className="h-5 w-5 text-purple-500" />}
          label="Genes Kept"
          value={`${qcReport.genes_after_filter.toLocaleString()} / ${qcReport.genes_before_filter.toLocaleString()}`}
          sub={`${filterPct}% removed`}
          bg="bg-purple-50"
        />
      </div>

      {/* Filtering thresholds */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtering Thresholds Applied</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ThresholdRow label="Min reads / sample" value={qcReport.min_reads_threshold.toLocaleString()} />
          <ThresholdRow label="Min genes detected / sample" value={qcReport.min_genes_threshold.toLocaleString()} />
          <ThresholdRow label="Min count / gene" value={qcReport.min_count_threshold.toString()} />
          <ThresholdRow label="Min replicates with min count" value={qcReport.min_reps_threshold.toString()} />
          <ThresholdRow
            label="DESeq2 design formula"
            value={qcReport.design_formula}
            mono
          />
          <ThresholdRow
            label="Batch correction"
            value={qcReport.has_batch_correction ? 'Enabled' : 'Disabled'}
            highlight={qcReport.has_batch_correction ? 'green' : 'gray'}
          />
        </div>
      </div>

      {/* Removed samples */}
      {qcReport.removed_sample_ids && qcReport.removed_sample_ids.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Removed Samples ({qcReport.removed_sample_ids.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {qcReport.removed_sample_ids.map((s) => (
              <span key={s} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-100 ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ThresholdRow({
  label,
  value,
  mono = false,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: 'green' | 'gray';
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`text-xs font-semibold ${mono ? 'font-mono' : ''} ${
          highlight === 'green'
            ? 'text-green-700'
            : highlight === 'gray'
            ? 'text-gray-400'
            : 'text-gray-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
