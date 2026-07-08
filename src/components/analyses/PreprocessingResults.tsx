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

/** Loose shape of analysis.params — used to show thresholds when no QC report exists. */
export interface AnalysisParamsLike {
  min_reads?: unknown;
  min_genes?: unknown;
  min_count?: unknown;
  min_reps?: unknown;
  design?: unknown;
}

interface PreprocessingResultsProps {
  qcReport: QCReport | null;
  params?: AnalysisParamsLike | null;
}

export default function PreprocessingResults({ qcReport, params }: PreprocessingResultsProps) {
  // Thresholds come from the QC report when present, otherwise from the analysis
  // params. (The aggregate per-sample QC counts are not persisted by the pipeline,
  // so the sample/gene stat cards only render when a real qc_report exists.)
  const thresholds = qcReport
    ? {
        minReads: qcReport.min_reads_threshold.toLocaleString(),
        minGenes: qcReport.min_genes_threshold.toLocaleString(),
        minCount: qcReport.min_count_threshold.toString(),
        minReps: qcReport.min_reps_threshold.toString(),
        design: qcReport.design_formula,
        batch: qcReport.has_batch_correction as boolean | undefined,
      }
    : params
      ? {
          minReads: Number(params.min_reads ?? 10).toLocaleString(),
          minGenes: Number(params.min_genes ?? 200).toLocaleString(),
          minCount: String(params.min_count ?? 5),
          minReps: String(params.min_reps ?? 2),
          design: String(params.design ?? 'auto'),
          batch: undefined as boolean | undefined,
        }
      : null;

  if (!qcReport && !thresholds) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }}>
        <AlertCircle className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--sl-red)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--sl-red-dark)' }}>QC report not available for this analysis.</p>
      </div>
    );
  }

  const filterPct =
    qcReport && qcReport.genes_before_filter > 0
      ? ((qcReport.genes_removed / qcReport.genes_before_filter) * 100).toFixed(1)
      : '0';
  const read = qcReport
    ? `${qcReport.samples_passed} of ${qcReport.total_input_samples} samples passed QC · ${qcReport.genes_after_filter.toLocaleString()} of ${qcReport.genes_before_filter.toLocaleString()} genes retained (${filterPct}% filtered out).`
    : 'Filtering thresholds applied to this run. Detailed per-sample QC counts were not recorded for this analysis.';

  return (
    <div className="space-y-5">
      {/* Plain-language read */}
      <div className="flex items-start gap-2.5 rounded-xl border p-3.5" style={{ background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }}>
        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--dc-green)' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{read}</p>
      </div>

      {/* Summary cards — only when the aggregate QC counts exist */}
      {qcReport && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} tone="var(--dc-indigo)" label="Samples input" value={qcReport.total_input_samples} />
          <StatCard icon={<CheckCircle className="h-5 w-5" />} tone="var(--dc-up-dark)" label="Samples passed" value={qcReport.samples_passed} />
          <StatCard icon={<XCircle className="h-5 w-5" />} tone="var(--dc-down-dark)" label="Samples removed" value={qcReport.samples_removed} />
          <StatCard
            icon={<Dna className="h-5 w-5" />}
            tone="var(--sl-violet)"
            label="Genes kept"
            value={`${qcReport.genes_after_filter.toLocaleString()} / ${qcReport.genes_before_filter.toLocaleString()}`}
            sub={`${filterPct}% removed`}
          />
        </div>
      )}

      {/* Filtering thresholds */}
      {thresholds && (
        <div className="gl-card p-5">
          <h3 className="mb-3 font-display text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Filtering thresholds applied</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <ThresholdRow label="Min reads / sample" value={thresholds.minReads} />
            <ThresholdRow label="Min genes detected / sample" value={thresholds.minGenes} />
            <ThresholdRow label="Min count / gene" value={thresholds.minCount} />
            <ThresholdRow label="Min replicates with min count" value={thresholds.minReps} />
            <ThresholdRow label="DESeq2 design formula" value={thresholds.design} mono />
            {thresholds.batch !== undefined && (
              <ThresholdRow label="Batch correction" value={thresholds.batch ? 'Enabled' : 'Disabled'} highlight={thresholds.batch ? 'green' : 'gray'} />
            )}
          </div>
        </div>
      )}

      {/* Removed samples */}
      {qcReport && qcReport.removed_sample_ids && qcReport.removed_sample_ids.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--sl-red-dark)' }}>
            <XCircle className="h-4 w-4" />
            Removed samples ({qcReport.removed_sample_ids.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {qcReport.removed_sample_ids.map((s) => (
              <span key={s} className="rounded-full px-2.5 py-0.5 font-mono text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--sl-red) 14%, var(--surface))', color: 'var(--sl-red-dark)' }}>
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
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="gl-card p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-[10px]"
          style={{ background: `color-mix(in oklab, ${tone} 12%, var(--surface))`, color: tone }}
        >
          {icon}
        </span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <p className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
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
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-secondary)' }}>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        className={`text-xs font-semibold ${mono ? 'font-mono' : ''}`}
        style={{
          color:
            highlight === 'green'
              ? 'var(--dc-up-dark)'
              : highlight === 'gray'
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
