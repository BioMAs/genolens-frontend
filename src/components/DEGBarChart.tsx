'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { Layout, PlotData } from 'plotly.js';

/* Direction colours: the literal values of --dc-up / --dc-down, which are
   defined once and not overridden in dark mode. Plotly needs concrete colours,
   so they are repeated here — up is green and down is red across the app, and
   this chart used to say the opposite (up in red, down in blue). */
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface DEGBarChartProps {
  dataset: Dataset;
  comparisonName: string;
}

type TopN = 5 | 10 | 15 | 20;

interface DEGGene {
  name: string;
  logFC: number;
  padj: number;
  direction: 'up' | 'down';
}

type QueryRow = Record<string, unknown>;

export default function DEGBarChart({ dataset, comparisonName }: DEGBarChartProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [topN, setTopN] = useState<TopN>(10);
  const [genes, setGenes] = useState<DEGGene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDEGs = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch enough rows to get top N up + top N down
        const response = await api.post(`/datasets/${dataset.id}/query`, {
          limit: 5000,
          sort_by: 'padj',
          sort_order: 'asc',
        });

        const data = (response.data.data ?? []) as QueryRow[];
        const columns: string[] = response.data.columns ?? [];

        // Resolve column names
        const meta = dataset.dataset_metadata as Record<string, unknown> | undefined;
        let logFCCol: string | null = null;
        let padjCol: string | null = null;
        const comparisons =
          meta?.comparisons && typeof meta.comparisons === 'object' && !Array.isArray(meta.comparisons)
            ? (meta.comparisons as Record<string, Record<string, unknown>>)
            : undefined;

        // Global multi-comparison dataset
        if (comparisons) {
          const compData = comparisons[comparisonName];
          if (compData) {
            logFCCol = typeof compData.logFC === 'string' ? compData.logFC : null;
            padjCol = typeof compData.padj === 'string' ? compData.padj : null;
          }
        }

        // Single-comparison fallback
        if (!logFCCol) {
          logFCCol =
            columns.find((c) => c === 'log2FoldChange') ??
            columns.find((c) => c.toLowerCase().includes('logfc')) ??
            columns.find((c) => c.toLowerCase().includes('log2')) ??
            null;
        }
        if (!padjCol) {
          padjCol =
            columns.find((c) => c === 'padj') ??
            columns.find((c) => c.toLowerCase().includes('padj')) ??
            columns.find((c) => c.toLowerCase().includes('adj')) ??
            null;
        }

        const geneCol =
          columns.find((c) => c === 'gene_name') ??
          columns.find((c) => c === 'gene') ??
          columns.find((c) => c === 'gene_id') ??
          columns.find((c) => c.toLowerCase().includes('gene') || c.toLowerCase().includes('symbol')) ??
          null;

        if (!logFCCol || !padjCol || !geneCol) {
          setError('Colonnes requises introuvables (logFC / padj / gene).');
          setLoading(false);
          return;
        }

        const PADJ_THRESHOLD = 0.05;
        const LOGFC_THRESHOLD = 0.58; // ~1.5 fold-change

        // Check for contrast column (precomputed up/down labels)
        const contrastCol = `contrast:${comparisonName}`;
        const hasContrastCol = columns.includes(contrastCol);

        const upGenes: DEGGene[] = [];
        const downGenes: DEGGene[] = [];

        data.forEach((row) => {
          const name = String(row[geneCol] ?? '');
          const logFC = Number(row[logFCCol]);
          const padj = Number(row[padjCol]);

          if (!name || isNaN(logFC) || isNaN(padj)) return;

          let direction: 'up' | 'down' | null = null;

          if (hasContrastCol) {
            const label = String(row[contrastCol] ?? '').toUpperCase();
            if (label === 'UP') direction = 'up';
            else if (label === 'DOWN') direction = 'down';
          } else {
            if (padj < PADJ_THRESHOLD && logFC > LOGFC_THRESHOLD) direction = 'up';
            else if (padj < PADJ_THRESHOLD && logFC < -LOGFC_THRESHOLD) direction = 'down';
          }

          if (direction === 'up') upGenes.push({ name, logFC, padj, direction });
          else if (direction === 'down') downGenes.push({ name, logFC, padj, direction });
        });

        // Sort up by logFC desc, down by logFC asc
        upGenes.sort((a, b) => b.logFC - a.logFC);
        downGenes.sort((a, b) => a.logFC - b.logFC);

        setGenes([...upGenes, ...downGenes]);
      } catch (err) {
        console.error('DEGBarChart fetch error:', err);
        setError('Failed to load DEG data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDEGs();
  }, [dataset, comparisonName]);

  if (loading) {
    return (
      <div className="gl-card p-5">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <div className="h-4 w-4 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--text-muted)' }} />
          Loading DEG chart…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gl-card p-5">
        <p className="text-sm" style={{ color: 'var(--sl-red-dark)' }}>{error}</p>
      </div>
    );
  }

  const upGenes = genes.filter((g) => g.direction === 'up').slice(0, topN);
  const downGenes = genes.filter((g) => g.direction === 'down').slice(0, topN);

  if (upGenes.length === 0 && downGenes.length === 0) {
    return (
      <div className="gl-card p-5">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No differentially expressed genes found.</p>
      </div>
    );
  }

  // Build a single horizontal bar chart: up genes (positive logFC, red) then down genes (negative logFC, blue)
  // Genes ordered from most significant up at top to most significant down at bottom
  const chartGenes = [...upGenes.slice().reverse(), ...downGenes];
  const yLabels = chartGenes.map((g) => g.name);
  const xValues = chartGenes.map((g) => g.logFC);
  const colors = chartGenes.map((g) => (g.direction === 'up' ? UP_COLOR : DOWN_COLOR));
  const hoverTexts = chartGenes.map(
    (g) => `<b>${g.name}</b><br>log2FC: ${g.logFC.toFixed(3)}<br>adj.p: ${g.padj.toExponential(2)}`
  );

  const chartHeight = Math.max(300, chartGenes.length * 24 + 80);

  return (
    <div className="gl-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Top regulated genes
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Top</span>
          {([5, 10, 15, 20] as TopN[]).map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className="rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              style={
                topN === n
                  ? { background: 'var(--sl-teal)', borderColor: 'var(--sl-teal)', color: '#fff' }
                  : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: UP_COLOR }} />
          Upregulated ({upGenes.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: DOWN_COLOR }} />
          Downregulated ({downGenes.length})
        </span>
      </div>

      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            x: xValues,
            y: yLabels,
            marker: { color: colors },
            hovertemplate: '%{customdata}<extra></extra>',
            customdata: hoverTexts,
          } as Partial<PlotData>,
        ]}
        layout={{
          height: chartHeight,
          margin: { l: 120, r: 60, t: 20, b: 50 },
          xaxis: {
            title: 'log2 Fold Change',
            zeroline: true,
            zerolinecolor: dark ? '#2d3550' : '#6b7280',
            gridcolor: dark ? '#1f2840' : '#e5e7eb',
          },
          yaxis: {
            automargin: true,
            tickfont: { size: 11 },
          },
          // Transparent in both themes: the card behind already carries the
          // surface colour, so the chart can't end up as a white box in dark mode.
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { color: dark ? '#8898ae' : '#4b5563' },
          shapes: [
            {
              type: 'line',
              x0: 0,
              x1: 0,
              y0: -0.5,
              y1: chartGenes.length - 0.5,
              line: { color: dark ? '#5a6a82' : '#9ca3af', width: 1, dash: 'dot' },
            },
          ],
        } as Partial<Layout>}
        config={{
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['select2d', 'lasso2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: `top${topN}_DEGs_${comparisonName}`,
            height: chartHeight + 100,
            width: 900,
          },
        }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}
