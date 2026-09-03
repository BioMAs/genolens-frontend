'use client';

/**
 * The heatmap, as the payoff of a selection rather than a parallel tab.
 *
 * It is the heaviest thing on the Explorer screen — it needs the matrix, a clustering
 * round-trip, and a second Plotly canvas next to the volcano's. And it is only meaningful for a
 * *set* of genes, which is exactly what the lasso now produces. So it lives in a collapsed
 * section that mounts nothing until opened: never construct Plotly for a panel nobody asked
 * for, and keep one WebGL context live rather than two.
 *
 * `<details>` because the design system has no Accordion, and adding one for a single use would
 * be out of proportion.
 *
 * Two modes rather than one. "Top DEGs" is what the panel always did. "Current selection" is
 * new, and possible because the endpoint always accepted explicit gene lists — only the
 * discovery inside `useHeatmapData` was hard-coded.
 */

import { useMemo, useState } from 'react';
import { Dataset } from '@/types';
import { useSelection, useThresholds } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import type { HeatmapGeneRow } from '@/components/heatmap/useHeatmapData';
import { isSignificant } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import DEGClusteringView from '@/components/analysis/DEGClusteringView';

type Mode = 'top' | 'selection';

interface Props {
  degDataset: Dataset;
  matrixDataset: Dataset;
  comparisonName: string;
  sampleIds?: string[];
  sampleConditionMap?: Record<string, string>;
}

export default function HeatmapSection({
  degDataset,
  matrixDataset,
  comparisonName,
  sampleIds,
  sampleConditionMap,
}: Props) {
  const selection = useSelection();
  const thresholds = useThresholds();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('top');

  const { data: cloud } = useVolcanoPoints(degDataset.id, comparisonName);

  /**
   * The selected genes as heatmap rows.
   *
   * Their fold change and padj come from the volcano cloud, which the plot above already has —
   * so switching to the selection costs no request beyond the clustering itself.
   */
  const selectedRows = useMemo<HeatmapGeneRow[]>(() => {
    if (selection.genes.length === 0) return [];
    const keys = new Set(selection.genes.map(normalizeGeneKey).filter(Boolean));
    return (cloud?.points ?? [])
      .filter((point) => keys.has(normalizeGeneKey(point.gene)))
      .map((point) => ({ gene_id: point.gene, logFC: point.x, padj: point.padj }));
  }, [selection.genes, cloud?.points]);

  /** Selected but absent from the plotted points, so they cannot be drawn. */
  const missing = selection.genes.length - selectedRows.length;

  const significantSelected = useMemo(
    () =>
      (cloud?.points ?? []).filter(
        (point) =>
          selectedRows.some((row) => row.gene_id === point.gene) &&
          isSignificant(point, thresholds)
      ).length,
    [cloud?.points, selectedRows, thresholds]
  );

  const useSelectionMode = mode === 'selection' && selectedRows.length > 0;

  const summary = open
    ? 'Heatmap & clustering'
    : selection.genes.length > 0
      ? `Heatmap & clustering — ${selection.genes.length.toLocaleString('en-US')} genes selected`
      : 'Heatmap & clustering';

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      data-testid="heatmap-section"
    >
      <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {summary}
      </summary>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex p-0.5"
              style={{
                background: 'var(--surface-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              {(['top', 'selection'] as const).map((value) => {
                const disabled = value === 'selection' && selectedRows.length === 0;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className="px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderRadius: 'var(--radius-control)',
                      background: mode === value ? 'var(--surface)' : 'transparent',
                      color: mode === value ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                    title={
                      disabled ? 'Select genes in the volcano or the table first' : undefined
                    }
                  >
                    {value === 'top' ? 'Top DEGs' : 'Current selection'}
                  </button>
                );
              })}
            </div>

            {useSelectionMode ? (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {selectedRows.length.toLocaleString('en-US')} selected gene
                {selectedRows.length === 1 ? '' : 's'}
                {significantSelected < selectedRows.length ? (
                  <>
                    {' · '}
                    {(selectedRows.length - significantSelected).toLocaleString('en-US')} not
                    significant at these thresholds
                  </>
                ) : null}
                {missing > 0 ? (
                  <>
                    {' · '}
                    <span
                      style={{ color: 'var(--text-muted)' }}
                      title="Selected genes that are not among the plotted points, so there are no values to draw."
                    >
                      {missing.toLocaleString('en-US')} without values here
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <DEGClusteringView
            degDataset={degDataset}
            matrixDataset={matrixDataset}
            sampleIds={sampleIds}
            comparisonName={comparisonName}
            sampleConditionMap={sampleConditionMap}
            genesOverride={useSelectionMode ? selectedRows : undefined}
          />
        </div>
      ) : null}
    </details>
  );
}
