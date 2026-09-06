'use client';

/**
 * The one DEG count for the comparison screen.
 *
 * Before this hook the page carried two counts that disagreed — 1,185 up in the header against
 * 1,195 up in the overview, both captioned with the same thresholds:
 *
 * - the header read `dataset_metadata.comparisons[…].deg_up`, frozen at ingestion by
 *   `_compute_stats_with_padj_col`. When the Parquet has a `contrast:<comparison>` column that
 *   function counts the upstream pipeline's UP/DOWN labels and **never applies padj or log2FC**
 *   at all; otherwise it applies `min_log2fc`, whose default is 1.0 rather than 0.58. Either way
 *   the number was blind to the threshold control.
 * - the overview recounted the volcano cloud at the live thresholds.
 *
 * The gap was the genes the upstream pipeline had not labelled but which pass the UI's own rule.
 * Everything on the screen now derives from this hook, so there is a single definition:
 * recomputed from the cloud at the thresholds the user is actually looking at.
 *
 * Costs nothing extra to call more than once — `useVolcanoPoints` is keyed without thresholds
 * (`['visualization','volcano-cloud', …]`), so every caller shares one React Query entry and a
 * threshold change recounts in memory without a request.
 */

import { useMemo } from 'react';
import { useThresholds } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { deriveSignificance, type SignificanceSummary } from '@/utils/volcano';

export interface SignificanceSummaryResult {
  /** Up / down / not-significant at the live thresholds. `null` until the cloud has loaded. */
  summary: SignificanceSummary | null;
  isLoading: boolean;
  isError: boolean;
}

export function useSignificanceSummary(
  datasetId: string,
  comparisonName: string,
  enabled: boolean = true
): SignificanceSummaryResult {
  const thresholds = useThresholds();
  const { data, isLoading, isError } = useVolcanoPoints(datasetId, comparisonName, enabled);

  const points = data?.points;

  const summary = useMemo(
    () => (points ? deriveSignificance(points, thresholds) : null),
    [points, thresholds]
  );

  return { summary, isLoading, isError };
}
