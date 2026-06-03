'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { Layout, PlotData } from 'plotly.js';

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
        const meta = dataset.dataset_metadata;
        let logFCCol: string | null = null;
        let padjCol: string | null = null;

        // Global multi-comparison dataset
        if (meta?.comparisons && typeof meta.comparisons === 'object' && !Array.isArray(meta.comparisons)) {
          const compData = meta.comparisons[comparisonName];
          if (compData) {
            logFCCol = compData.logFC ?? null;
            padjCol = compData.padj ?? null;
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
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
          Loading DEG chart…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const upGenes = genes.filter((g) => g.direction === 'up').slice(0, topN);
  const downGenes = genes.filter((g) => g.direction === 'down').slice(0, topN);

  if (upGenes.length === 0 && downGenes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm text-gray-500">No differentially expressed genes found.</p>
      </div>
    );
  }

  // Build a single horizontal bar chart: up genes (positive logFC, red) then down genes (negative logFC, blue)
  // Genes ordered from most significant up at top to most significant down at bottom
  const chartGenes = [...upGenes.slice().reverse(), ...downGenes];
  const yLabels = chartGenes.map((g) => g.name);
  const xValues = chartGenes.map((g) => g.logFC);
  const colors = chartGenes.map((g) => (g.direction === 'up' ? '#ef4444' : '#3b82f6'));
  const hoverTexts = chartGenes.map(
    (g) => `<b>${g.name}</b><br>log2FC: ${g.logFC.toFixed(3)}<br>adj.p: ${g.padj.toExponential(2)}`
  );

  const chartHeight = Math.max(300, chartGenes.length * 24 + 80);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Top Regulated DEGs</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Top</span>
          {([5, 10, 15, 20] as TopN[]).map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                topN === n
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
          Up-regulated ({upGenes.length})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          Down-regulated ({downGenes.length})
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
            zerolinecolor: '#6b7280',
            gridcolor: '#e5e7eb',
          },
          yaxis: {
            automargin: true,
            tickfont: { size: 11 },
          },
          plot_bgcolor: '#f9fafb',
          paper_bgcolor: '#ffffff',
          shapes: [
            {
              type: 'line',
              x0: 0,
              x1: 0,
              y0: -0.5,
              y1: chartGenes.length - 0.5,
              line: { color: '#9ca3af', width: 1, dash: 'dot' },
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
