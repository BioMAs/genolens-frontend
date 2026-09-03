'use client';

/**
 * The volcano plot, on Plotly `scattergl`, emitting a gene selection.
 *
 * **Why this chart moved off Recharts.** `CLAUDE.md` already prescribes Plotly for interactive
 * bioinformatics plots and names the volcano as the example, so the Recharts version was the
 * deviation. Recharts also cannot do what this screen needs: it has no `onSelected`, its
 * `<Brush>` is a one-dimensional axis slider, and it rendered one `<circle>` *and* one `<Cell>`
 * per point — roughly ten thousand React elements reconciled on every parent state change.
 * `scattergl` puts the same five thousand points on WebGL in three traces.
 *
 * Plotly is already a dependency used by nine other components through the identical
 * `dynamic(..., { ssr: false })` line, so this adds nothing to the bundle.
 *
 * Lasso and box selection are deliberately **not** enabled yet: `onSelected` is a later slice,
 * and offering a lasso that does nothing would be worse than not offering it. Click selects.
 */

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Layout } from 'plotly.js';
import { Dataset } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useComparisonActions,
  useSelection,
  useThresholds,
  useViewPreferences,
} from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { isSignificant, UNKNOWN_GENE, type VolcanoPoint } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
      Loading plot…
    </div>
  ),
});

/**
 * Axis and grid colours per theme, as literal values.
 *
 * Plotly styles in JavaScript, so it cannot resolve `var(--border)`. Reading the computed value
 * instead would be wrong here: `ThemeContext` toggles the `.dark` class *inside an effect*, so a
 * read during render returns the previous theme's colours. These are the resolved values of
 * `--border`, `--text-muted` and `--text-secondary` from `globals.css`; `DEGBarChart` repeats
 * its direction colours for the same reason.
 */
const PLOT_THEME = {
  light: { grid: '#edeff2', axis: '#8b93a0', text: '#5b6472' },
  dark: { grid: '#1f2840', axis: '#5a6a82', text: '#8898ae' },
} as const;

/** Trace order is the contract for Plotly's `curveNumber`, so it is fixed here. */
const TRACE_ORDER = ['ns', 'down', 'up'] as const;
type TraceKey = (typeof TRACE_ORDER)[number];

interface Bucket {
  x: number[];
  y: number[];
  genes: string[];
  padj: number[];
}

interface ClickedPoint {
  curveNumber: number;
  pointNumber: number;
}

interface PlotClickEvent {
  points?: ClickedPoint[];
  event?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean };
}

interface Props {
  dataset: Dataset;
  comparisonName: string;
}

export default function VolcanoPanel({ dataset, comparisonName }: Props) {
  const thresholds = useThresholds();
  const selection = useSelection();
  const { colorblind } = useViewPreferences();
  const { setColorblind, selectGenes, toggleGene, clearSelection } = useComparisonActions();
  const { theme } = useTheme();

  const palette = getPalette(colorblind ? 'colorblind' : 'standard');
  const plotTheme = PLOT_THEME[theme === 'dark' ? 'dark' : 'light'];

  const { data, isLoading, error, isFetching } = useVolcanoPoints(dataset.id, comparisonName);
  const points = data?.points;

  // Bucket once per threshold change. The gene arrays are the index maps: Plotly reports a click
  // as (curveNumber, pointNumber), and this makes resolving it back to a gene O(1) and immune to
  // drift, because the traces and the maps are built in the same pass.
  const buckets = useMemo(() => {
    const empty = (): Bucket => ({ x: [], y: [], genes: [], padj: [] });
    const out: Record<TraceKey, Bucket> = { ns: empty(), down: empty(), up: empty() };

    for (const point of points ?? []) {
      const key: TraceKey = !isSignificant(point, thresholds)
        ? 'ns'
        : point.x > 0
          ? 'up'
          : 'down';
      const bucket = out[key];
      bucket.x.push(point.x);
      bucket.y.push(point.y);
      bucket.genes.push(point.gene);
      bucket.padj.push(point.padj);
    }
    return out;
  }, [points, thresholds]);

  /** Indices of the selected genes, per trace, so the plot reflects a selection it did not make. */
  const selectedByTrace = useMemo(() => {
    const keys = new Set(selection.genes.map(normalizeGeneKey).filter(Boolean));
    if (keys.size === 0) return null;

    return TRACE_ORDER.map((trace) => {
      const indices: number[] = [];
      buckets[trace].genes.forEach((gene, index) => {
        if (keys.has(normalizeGeneKey(gene))) indices.push(index);
      });
      return indices;
    });
  }, [buckets, selection.genes]);

  const handleClick = useCallback(
    (event: PlotClickEvent) => {
      const hit = event.points?.[0];
      if (!hit) return;

      const trace = TRACE_ORDER[hit.curveNumber];
      const gene = trace ? buckets[trace].genes[hit.pointNumber] : undefined;
      // The backend substitutes this sentinel when a dataset has no recognisable gene column;
      // selecting it would put a non-gene in the card and in the URL.
      if (!gene || gene === UNKNOWN_GENE) return;

      const additive = event.event?.shiftKey || event.event?.metaKey || event.event?.ctrlKey;
      if (additive) {
        toggleGene(gene, 'volcano');
      } else {
        selectGenes([gene], 'volcano');
      }
    },
    [buckets, selectGenes, toggleGene]
  );

  const traces = useMemo(
    () =>
      TRACE_ORDER.map((trace, index) => {
        const bucket = buckets[trace];
        const colour =
          trace === 'up' ? palette.up : trace === 'down' ? palette.down : palette.ns;
        return {
          type: 'scattergl' as const,
          mode: 'markers' as const,
          name:
            trace === 'up' ? 'Upregulated' : trace === 'down' ? 'Downregulated' : 'Not significant',
          x: bucket.x,
          y: bucket.y,
          customdata: bucket.genes.map((gene, i) => [gene, bucket.padj[i]] as [string, number]),
          hovertemplate:
            '<b>%{customdata[0]}</b><br>log2FC %{x:.2f}<br>padj %{customdata[1]:.2e}<extra></extra>',
          marker: {
            size: trace === 'ns' ? 4 : 6,
            color: colour,
            opacity: trace === 'ns' ? 0.45 : 0.85,
            line: { width: 0 },
          },
          // Dim everything unselected once a selection exists, so the picked genes stand out
          // without changing the plot's shape.
          ...(selectedByTrace
            ? {
                selectedpoints: selectedByTrace[index],
                selected: { marker: { opacity: 1, size: 10, color: colour } },
                unselected: { marker: { opacity: 0.12 } },
              }
            : {}),
        };
      }),
    [buckets, palette, selectedByTrace]
  );

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 60, r: 20, t: 10, b: 50 },
      // Transparent, so the card behind shows through and the plot follows the theme instead of
      // painting a white block in dark mode.
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: plotTheme.text, size: 11 },
      hovermode: 'closest',
      dragmode: 'pan',
      showlegend: false,
      xaxis: {
        title: { text: 'log2 fold change' },
        zeroline: true,
        zerolinecolor: plotTheme.grid,
        gridcolor: plotTheme.grid,
        linecolor: plotTheme.grid,
        tickcolor: plotTheme.axis,
      },
      yaxis: {
        title: { text: '−log10 padj' },
        zeroline: false,
        gridcolor: plotTheme.grid,
        linecolor: plotTheme.grid,
        tickcolor: plotTheme.axis,
      },
      shapes: [
        ...[thresholds.logfc, -thresholds.logfc].map((x) => ({
          type: 'line' as const,
          x0: x,
          x1: x,
          yref: 'paper' as const,
          y0: 0,
          y1: 1,
          line: { color: plotTheme.axis, width: 1, dash: 'dot' as const },
        })),
        {
          type: 'line' as const,
          xref: 'paper' as const,
          x0: 0,
          x1: 1,
          y0: -Math.log10(thresholds.padj),
          y1: -Math.log10(thresholds.padj),
          line: { color: plotTheme.axis, width: 1, dash: 'dot' as const },
        },
      ],
    }),
    [plotTheme, thresholds]
  );

  const aiContext = useMemo(() => {
    const top = (bucket: Bucket, descending: boolean) =>
      bucket.genes
        .map((gene, i) => ({ gene_id: gene, log_fc: bucket.x[i] }))
        .sort((a, b) => (descending ? b.log_fc - a.log_fc : a.log_fc - b.log_fc))
        .slice(0, 5);

    return {
      comparison_name: comparisonName,
      up_count: buckets.up.genes.length,
      down_count: buckets.down.genes.length,
      padj_threshold: thresholds.padj,
      logfc_threshold: thresholds.logfc,
      top_up_genes: top(buckets.up, true),
      top_down_genes: top(buckets.down, false),
    };
  }, [buckets, comparisonName, thresholds]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading plot data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Failed to load plot data.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {isFetching ? <span style={{ color: 'var(--sl-violet)' }}>Loading…</span> : null}
          {selection.genes.length > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              className="underline"
              style={{ color: 'var(--sl-teal-dark)' }}
            >
              Clear selection
            </button>
          ) : (
            <span>Click a point to inspect a gene · shift-click to add</span>
          )}
        </div>
        <ColorblindToggle value={colorblind} onChange={setColorblind} />
      </div>

      <AIChartAssistant
        datasetId={dataset.id}
        chartType="volcano"
        contextKey={comparisonName}
        context={aiContext}
        label="Volcano Plot"
        panelClassName="max-h-[500px]"
      />

      <div className="h-[26rem] w-full" data-testid="volcano-plot">
        <Plot
          data={traces}
          layout={layout}
          onClick={handleClick}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
          config={{
            displaylogo: false,
            responsive: true,
            // Lasso and box selection arrive with the multi-selection card; a lasso that
            // selected nothing would read as a broken control.
            modeBarButtonsToRemove: [
              'select2d',
              'lasso2d',
              'autoScale2d',
              'toggleSpikelines',
              'hoverClosestCartesian',
              'hoverCompareCartesian',
            ],
          }}
        />
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-4 pt-3 text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        {[
          { colour: palette.up, label: `${buckets.up.genes.length.toLocaleString('en-US')} up` },
          {
            colour: palette.down,
            label: `${buckets.down.genes.length.toLocaleString('en-US')} down`,
          },
          {
            colour: palette.ns,
            label: `${buckets.ns.genes.length.toLocaleString('en-US')} not significant`,
          },
        ].map(({ colour, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ background: colour, borderRadius: 3 }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export type { VolcanoPoint };
