'use client';

/**
 * The one significance control of the comparison screens.
 *
 * It replaces three disagreeing sources: the volcano's private pair, the DEG table's private
 * pair, and a hard-coded line of text in the pane header that could contradict both.
 *
 * Fixed options rather than free number fields. Two reasons, both about honesty:
 *
 * - `deg_genes` only ever received genes that were already significant at ingestion
 *   (padj < 0.05, |log2FC| > 0.58 — `data_processor.py:26-27`), so the thresholds can only be
 *   **tightened**. A free field invites loosening, which would leave the volcano and the table
 *   describing different populations; a bounded list makes the ceiling self-evident instead of
 *   silently clamping a number the user just typed.
 * - A `<select>` cannot emit `NaN`, an empty string, or a half-typed `0.0`, so no downstream
 *   comparison ever has to defend itself against garbage.
 */

import { useId } from 'react';
import { useThresholdControl } from '@/contexts/ComparisonSelectionContext';
import { INGESTION_LOGFC_MIN, INGESTION_PADJ_MAX } from '@/utils/volcano';

/** Tightening steps, loosest (the ingestion ceiling) first. */
const PADJ_OPTIONS = [INGESTION_PADJ_MAX, 0.01, 0.005, 0.001, 0.0001];

/** `0.58` is a 1.5-fold change; the rest are the conventional round multiples. */
const LOGFC_OPTIONS: Array<{ value: number; label: string }> = [
  { value: INGESTION_LOGFC_MIN, label: '0.58  (1.5×)' },
  { value: 1, label: '1.0  (2×)' },
  { value: 1.5, label: '1.5  (2.8×)' },
  { value: 2, label: '2.0  (4×)' },
  { value: 3, label: '3.0  (8×)' },
];

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text-primary)',
};

export default function ThresholdControl({ className = '' }: { className?: string }) {
  const [thresholds, setThresholds] = useThresholdControl();
  const padjId = useId();
  const logfcId = useId();

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <label htmlFor={padjId} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          padj &lt;
        </label>
        <select
          id={padjId}
          aria-label="Adjusted p-value threshold"
          value={thresholds.padj}
          onChange={(e) => setThresholds({ padj: Number(e.target.value) })}
          className="px-2 py-1 text-xs"
          style={selectStyle}
        >
          {PADJ_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={logfcId} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          |log2FC| &gt;
        </label>
        <select
          id={logfcId}
          aria-label="Absolute log2 fold change threshold"
          value={thresholds.logfc}
          onChange={(e) => setThresholds({ logfc: Number(e.target.value) })}
          className="px-2 py-1 text-xs"
          style={selectStyle}
        >
          {LOGFC_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-xs"
        style={{ color: 'var(--text-muted)' }}
        title={
          `Genes were stored at ingestion using padj < ${INGESTION_PADJ_MAX} and ` +
          `|log2FC| > ${INGESTION_LOGFC_MIN}. Loosening beyond that would show a plot the ` +
          `gene table cannot follow, so these are the widest settings available.`
        }
      >
        Widest available — set at ingestion
      </p>
    </div>
  );
}
