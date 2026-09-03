'use client';

/**
 * One gene's expression across the conditions of a comparison, as boxplots.
 *
 * Split out of `GeneExpressionViewer` so the gene can come from outside. The viewer owned its
 * own gene: local state, an autocomplete, and an effect that auto-selected `allGenes[0]` on
 * mount. None of that works in a detail card, where the subject is whatever the user clicked.
 * The viewer keeps the autocomplete and renders this.
 *
 * Three things fixed while extracting, all of which were breaking dark mode or lying:
 * the direction colours were hard-coded `#3b82f6`/`#ef4444` instead of the shared palette, the
 * backgrounds were literal `#ffffff` and `#f9fafb`, and the height was fixed at 400 — too tall
 * for a 300px column.
 */

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Layout, PlotData } from 'plotly.js';
import { useTheme } from '@/contexts/ThemeContext';
import { getPalette } from '@/utils/chartPalettes';
import type { GeneExpression } from '@/hooks/useGeneExpressionByCondition';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

/** Resolved values of `--border` and `--text-secondary`; Plotly cannot read a CSS variable. */
const PLOT_THEME = {
  light: { grid: '#edeff2', text: '#5b6472' },
  dark: { grid: '#1f2840', text: '#8898ae' },
} as const;

interface Props {
  data: GeneExpression | null | undefined;
  loading?: boolean;
  /** Short in a card, taller standalone. */
  height?: number;
  /** The modebar is noise inside a 300px column. */
  showModeBar?: boolean;
  colorblind?: boolean;
}

export default function GeneExpressionBoxplot({
  data,
  loading = false,
  height = 220,
  showModeBar = false,
  colorblind = false,
}: Props) {
  const { theme } = useTheme();
  const plotTheme = PLOT_THEME[theme === 'dark' ? 'dark' : 'light'];
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const traces = useMemo<Partial<PlotData>[]>(() => {
    if (!data) return [];
    // Two groups: the first condition reads as the reference, the second as the contrast.
    const colours = [palette.down, palette.up];
    return data.groups.map((group, index) => ({
      y: group.values,
      type: 'box' as const,
      name: group.name || 'Samples',
      marker: { color: colours[index % colours.length] },
      boxmean: 'sd' as const,
      boxpoints: 'all' as const,
      jitter: 0.3,
      pointpos: -1.8,
      hovertemplate: '%{y:.2f}<extra>%{x}</extra>',
    }));
  }, [data, palette]);

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height,
      margin: { l: 44, r: 8, t: 8, b: 28 },
      // Transparent, so the card behind shows through in either theme.
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: plotTheme.text, size: 10 },
      showlegend: false,
      xaxis: { gridcolor: plotTheme.grid, linecolor: plotTheme.grid },
      yaxis: { gridcolor: plotTheme.grid, linecolor: plotTheme.grid, zeroline: false },
    }),
    [height, plotTheme]
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, color: 'var(--text-muted)' }}
      >
        Loading expression…
      </div>
    );
  }

  if (!data || data.groups.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-center text-xs"
        style={{ height, color: 'var(--text-muted)' }}
      >
        No expression values for this gene in the samples of this comparison.
      </div>
    );
  }

  return (
    <div style={{ height }} data-testid="gene-expression-boxplot">
      <Plot
        data={traces}
        layout={layout}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
        config={{
          displayModeBar: showModeBar,
          displaylogo: false,
          responsive: true,
          modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
        }}
      />
    </div>
  );
}
