'use client';

import { useMemo } from 'react';

/** Deterministic grouping: the UI is English, and SSR must match the client. */
const num = (value: number) => value.toLocaleString('en-US');

export interface ComparisonStats {
  degUp: number;
  degDown: number;
  degTotal: number;
  /** Genes that entered the test — the denominator of the response. */
  genesTested?: number;
}

interface Props {
  /** Decoded comparison key, e.g. "KO_vs_WT". */
  comparisonName: string;
  stats: ComparisonStats | null;
  /** sample → condition, for the per-condition sample counts. */
  sampleConditionMap: Record<string, string>;
  loading?: boolean;
  /**
   * Thresholds the counts were derived at, shown so the numbers can be read in context.
   *
   * Required on purpose. These used to carry defaults of 0.05 / 0.58 that no caller ever
   * overrode, so the caption stated a rule the numbers had not been computed with — the counts
   * came frozen from ingestion while the caption claimed the UI's own thresholds.
   */
  padjThreshold: number;
  log2fcThreshold: number;
}

/**
 * Landing synthesis of a comparison: what the contrast says, in one read.
 *
 * The balance bar is the centrepiece — the two conditions anchor its ends and
 * the split shows which side the response leans to, which is the first thing a
 * biologist looks for. Same two-segment idiom as the dashboard's comparison
 * card (see JumpBackInCard), promoted to hero scale.
 */
export default function ComparisonSynthesis({
  comparisonName,
  stats,
  sampleConditionMap,
  loading = false,
  padjThreshold,
  log2fcThreshold,
}: Props) {
  const [testCondition, referenceCondition] = useMemo(() => {
    const parts = comparisonName.split('_vs_');
    return parts.length === 2 ? parts : [null, null];
  }, [comparisonName]);

  const sampleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(sampleConditionMap).forEach((condition) => {
      counts[condition] = (counts[condition] ?? 0) + 1;
    });
    return counts;
  }, [sampleConditionMap]);

  if (loading) {
    return (
      <div className="gl-card p-5">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton mt-4 h-2.5 w-full rounded" />
        <div className="skeleton mt-4 h-3 w-1/2 rounded" />
      </div>
    );
  }

  if (!stats) return null;

  const { degUp, degDown, degTotal, genesTested } = stats;
  const scale = degUp + degDown;
  const upShare = scale > 0 ? degUp / scale : 0.5;
  const upPct = Math.round(upShare * 100);
  const leaning = upPct >= 50 ? 'upregulated' : 'downregulated';
  const leaningPct = upPct >= 50 ? upPct : 100 - upPct;

  const totalSamples = Object.keys(sampleConditionMap).length;
  const sampleDetail = [testCondition, referenceCondition]
    .filter((c): c is string => !!c && sampleCounts[c] > 0)
    .map((c) => `${c} ${sampleCounts[c]}`)
    .join(' · ');

  const context = [
    genesTested ? `of ${num(genesTested)} genes tested` : null,
    `padj < ${padjThreshold}`,
    `|log2FC| > ${log2fcThreshold}`,
    totalSamples > 0
      ? `${totalSamples} sample${totalSamples === 1 ? '' : 's'}${sampleDetail ? ` (${sampleDetail})` : ''}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="gl-card p-5">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.6px]"
        style={{ color: 'var(--sl-teal)' }}
      >
        Response
      </div>

      <h2
        className="mt-1 font-display text-[19px] font-semibold leading-[1.3]"
        style={{ color: 'var(--text-primary)' }}
      >
        {degTotal === 0 ? (
          <>No gene passes the significance thresholds</>
        ) : (
          <>
            {num(degTotal)} genes respond
            {testCondition ? ` in ${testCondition}` : ''} — {leaningPct}% {leaning}
          </>
        )}
      </h2>

      {degTotal > 0 && (
        <div className="mt-4">
          {/* Ends of the bar name the two sides of the contrast */}
          <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[12px]">
            <span className="font-semibold" style={{ color: 'var(--dc-up-dark)' }}>
              ↑ {num(degUp)} up{testCondition ? ` in ${testCondition}` : ''}
            </span>
            <span className="font-semibold" style={{ color: 'var(--dc-down-dark)' }}>
              ↓ {num(degDown)} down
              {referenceCondition ? ` (up in ${referenceCondition})` : ''}
            </span>
          </div>

          <div
            role="img"
            aria-label={`${num(degUp)} genes upregulated, ${num(degDown)} downregulated`}
            className="flex h-2.5 overflow-hidden rounded"
            style={{ background: 'var(--n-100)' }}
          >
            <span
              className="gl-bar-grow h-full"
              style={{ width: `${upShare * 100}%`, background: 'var(--dc-up)' }}
            />
            <span className="h-full flex-1" style={{ background: 'var(--dc-down)' }} />
          </div>
        </div>
      )}

      <p className="mt-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {context.join(' · ')}
      </p>
    </div>
  );
}
