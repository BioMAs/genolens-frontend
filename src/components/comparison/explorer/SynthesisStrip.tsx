'use client';

/**
 * Up / down counts at the current thresholds, above the plot and the table they govern.
 *
 * Counts come from `useSignificanceSummary`, the page's single DEG definition — the same hook the
 * header reads, so this strip can no longer contradict it. See that hook for why the two used to
 * disagree.
 *
 * Deliberately not read from the response's `significant_genes`: that is the server's verdict at
 * whatever thresholds the request carried, and the request always carries the ingestion defaults.
 * Nor from `total_genes`, whose meaning differs between the two server paths — points returned on
 * the cached path (`datasets.py:2039`) versus genes tested on the cold path (`:2159`).
 */

import { useViewPreferences } from '@/contexts/ComparisonSelectionContext';
import { useSignificanceSummary } from '@/hooks/useSignificanceSummary';
import { getPalette } from '@/utils/chartPalettes';
import ThresholdControl from './ThresholdControl';

interface Props {
  datasetId: string;
  comparisonName: string;
  /** Conditions being contrasted, when they can be parsed from the comparison name. */
  conditions?: { left: string; right: string } | null;
}

export default function SynthesisStrip({ datasetId, comparisonName, conditions }: Props) {
  const { colorblind } = useViewPreferences();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const { summary, isLoading, isError } = useSignificanceSummary(datasetId, comparisonName);

  const total = summary?.significant ?? 0;
  const upShare = total > 0 ? ((summary?.up ?? 0) / total) * 100 : 50;

  return (
    <div
      className="gl-card p-4"
      style={{ borderRadius: 'var(--radius-panel)' }}
      data-testid="synthesis-strip"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {isLoading ? (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Counting significant genes…
            </span>
          ) : isError || !summary ? (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Counts unavailable
            </span>
          ) : (
            <>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="font-display text-xl font-semibold"
                  style={{ color: palette.up }}
                >
                  {summary.up.toLocaleString('en-US')}
                </span>{' '}
                up
              </span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="font-display text-xl font-semibold"
                  style={{ color: palette.down }}
                >
                  {summary.down.toLocaleString('en-US')}
                </span>{' '}
                down
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {summary.ns.toLocaleString('en-US')} not significant
              </span>
            </>
          )}
        </div>

        <ThresholdControl />
      </div>

      {/* Balance bar — the two conditions anchored at its ends, the idiom the overview
          already uses. Hidden while there is nothing to weigh. */}
      {!isLoading && !isError && summary && total > 0 && (
        <div className="mt-3">
          <div
            className="flex h-2 w-full overflow-hidden"
            style={{ borderRadius: 999, background: palette.ns }}
            role="img"
            aria-label={
              `${summary.up.toLocaleString('en-US')} genes up and ` +
              `${summary.down.toLocaleString('en-US')} down out of ` +
              `${total.toLocaleString('en-US')} significant`
            }
          >
            <div style={{ width: `${upShare}%`, background: palette.up }} />
            <div style={{ width: `${100 - upShare}%`, background: palette.down }} />
          </div>
          {conditions && (
            <div
              className="mt-1 flex justify-between text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="truncate">{conditions.left}</span>
              <span className="truncate">{conditions.right}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
