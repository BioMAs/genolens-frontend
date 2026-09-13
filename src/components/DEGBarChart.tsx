'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { Layout, PlotData } from 'plotly.js';
import { useChartTheme } from '@/utils/chartTheme';
import { buildPlotlyLayout } from '@/utils/plotlyLayout';
import ChartCard, { type ChartState } from '@/components/charts/ChartCard';
import { cn } from '@/lib/cn';

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
  const chartTheme = useChartTheme();
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

  const upGenes = genes.filter((g) => g.direction === 'up').slice(0, topN);
  const downGenes = genes.filter((g) => g.direction === 'down').slice(0, topN);

  // Quatre cartes distinctes se relayaient — chargement, erreur, vide, pret —
  // et AUCUNE ne portait l'en-tete : le selecteur « Top N » disparaissait
  // pendant le chargement, puis reapparaissait ailleurs. Il vit desormais dans
  // la legende de la figure, donc il reste ou il est.
  const state: ChartState = loading
    ? 'loading'
    : error
      ? 'error'
      : upGenes.length === 0 && downGenes.length === 0
        ? 'empty'
        : 'ready';

  // Build a single horizontal bar chart: up genes (positive logFC, red) then down genes (negative logFC, blue)
  // Genes ordered from most significant up at top to most significant down at bottom
  const chartGenes = [...upGenes.slice().reverse(), ...downGenes];
  const yLabels = chartGenes.map((g) => g.name);
  const xValues = chartGenes.map((g) => g.logFC);
  // `#22c55e` / `#ef4444` etaient recopies ici « faute de pouvoir resoudre
  // var() ». C'est exactement ce que `useChartTheme` fait, et la copie
  // figeait la paire CLAIRE, ou le vert donne 2,28:1 sur blanc.
  const colors = chartGenes.map((g) => (g.direction === 'up' ? chartTheme.up : chartTheme.down));
  const hoverTexts = chartGenes.map(
    (g) => `<b>${g.name}</b><br>log2FC: ${g.logFC.toFixed(3)}<br>adj.p: ${g.padj.toExponential(2)}`
  );

  const chartHeight = Math.max(300, chartGenes.length * 24 + 80);

  return (
    <ChartCard
      title="Top regulated genes"
      state={state}
      minHeight={380}
      error={error ?? undefined}
      empty="No differentially expressed genes found."
      actions={
        <>
          <span className="text-caption text-muted">Top</span>
          {([5, 10, 15, 20] as TopN[]).map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              // L'etat selectionne passait par le teal de MARQUE : la regle
              // reserve un seul accent interactif, l'indigo. Et la hauteur
              // rejoint le cran `sm` du systeme au lieu d'un py-0.5 isole.
              className={cn(
                'h-7 rounded-sm border px-2.5 text-caption font-semibold transition-colors',
                topN === n
                  ? 'border-accent-soft bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface text-secondary hover:text-primary',
              )}
            >
              {n}
            </button>
          ))}
        </>
      }
    >

      <div className="mb-3 flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: chartTheme.up }} />
          Upregulated ({upGenes.length})
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: chartTheme.down }} />
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
        layout={buildPlotlyLayout(chartTheme, {
          height: chartHeight,
          margin: { l: 120, r: 60, t: 20, b: 50 },
          // Six couleurs etaient choisies ici par un ternaire sur le theme —
          // grille, ligne de zero, encre, trait de reference, et un fond
          // transparent. La fabrique les fournit toutes depuis les memes jetons
          // que le reste de l'application, donc le ternaire disparait avec elles.
          xaxis: {
            title: 'log2 Fold Change',
            zeroline: true,
          },
          yaxis: {
            automargin: true,
            tickfont: { size: 11 },
          },
          shapes: [
            {
              type: 'line',
              x0: 0,
              x1: 0,
              y0: -0.5,
              y1: chartGenes.length - 0.5,
              line: { color: chartTheme.axis, width: 1, dash: 'dot' },
            },
          ],
        }) as Partial<Layout>}
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
    </ChartCard>
  );
}
