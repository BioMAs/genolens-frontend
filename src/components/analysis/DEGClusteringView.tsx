'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Dataset } from '@/types';
import { ClusteringParams } from '@/components/heatmap/types';
import { useHeatmapData, type HeatmapGeneRow } from '@/components/heatmap/useHeatmapData';
import { Loader2, Download } from 'lucide-react';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import { getPalette } from '@/utils/chartPalettes';
import { Layout, PlotData } from 'plotly.js';

// Build a Plotly discrete (stepped) colorscale so each category maps to a flat color.
// Category i is encoded as z = (i + 0.5) / n, which lands in the middle of its band.
function discreteColorscale(colors: string[]): [number, string][] {
  const n = colors.length;
  const scale: [number, string][] = [];
  for (let i = 0; i < n; i++) {
    scale.push([i / n, colors[i]]);
    scale.push([(i + 1) / n, colors[i]]);
  }
  return scale;
}

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface DEGClusteringViewProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
  sampleConditionMap?: Record<string, string>;
  /** Plot these genes instead of the top DEGs — the current selection, say. */
  genesOverride?: HeatmapGeneRow[];
}

type DisplayMode = 'expression' | 'log2fc';

// Viridis-like colorscale (blue → grey → yellow) matching the reference figure
const VIRIDIS_COLORSCALE: [number, string][] = [
  [0.0, '#000080'],
  [0.15, '#0c3b6b'],
  [0.3, '#2e6fa3'],
  [0.45, '#6e91a8'],
  [0.6, '#a8a878'],
  [0.75, '#d4c836'],
  [1.0, '#ffff00'],
];

// Colorblind-safe sequential scale (dark blue → light yellow)
const COLORBLIND_SEQ_COLORSCALE: [number, string][] = [
  [0.0, '#0072B2'],
  [0.33, '#56B4E9'],
  [0.66, '#F0E442'],
  [1.0, '#E69F00'],
];

// DEG status sidebar: purple for DOWN (-1), green for UP (+1)
const DEG_STATUS_COLORSCALE: [number, string][] = [
  [0.0, '#7B2D8B'],  // purple  — DOWN
  [0.49, '#7B2D8B'],
  [0.51, '#3A7D44'],  // green  — UP
  [1.0, '#3A7D44'],
];

// Default params: show ALL DEGs (top_n_genes: 0 = no limit)
const DEG_CLUSTERING_PARAMS: ClusteringParams = {
  top_n_genes: 0,
  method: 'ward',
  metric: 'euclidean',
  cluster_rows: true,
  cluster_cols: true,
};

export default function DEGClusteringView({
  degDataset,
  matrixDataset,
  sampleIds,
  comparisonName,
  sampleConditionMap,
  genesOverride,
}: DEGClusteringViewProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('expression');
  const [colorblindMode, setColorblindMode] = useState(false);

  // If sampleIds is undefined or empty, ALL matrix samples will be shown
  // (happens when no metadata dataset is uploaded for the study).
  const hasSampleFilter = sampleIds && sampleIds.length > 0;

  const { loading, error, plotData, geneMetadata, isPreview } = useHeatmapData({
    degDataset,
    matrixDataset,
    sampleIds,
    comparisonName,
    params: DEG_CLUSTERING_PARAMS,
    genesOverride,
  });

  // ---- Loading / Error states ----
  if (loading && !plotData) {
    return (
      <div className="flex h-96 items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-gray-500">Generating DEG heatmap…</span>
      </div>
    );
  }

  if (error && !plotData) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        <p className="font-semibold">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!plotData) return null;

  // ---- Data preparation ----
  const nDEGs = plotData.y.length;
  const nSamples = plotData.x.length;

  // DEG status per row: +1 = UP, -1 = DOWN
  const degStatus = plotData.logFCs.map(lfc => (lfc >= 0 ? 1 : -1));

  // Choose main z matrix and colorscale based on display mode
  let mainZ: number[][];
  let colorscale: string | [number, string][];
  let zmin: number | undefined;
  let zmax: number | undefined;
  let colorbarTitle: string;

  if (displayMode === 'expression') {
    mainZ = plotData.z;
    colorscale = colorblindMode ? COLORBLIND_SEQ_COLORSCALE : VIRIDIS_COLORSCALE;
    // z-scored by backend: clamp between -2 and 2 for visual clarity
    zmin = -2;
    zmax = 2;
    colorbarTitle = 'Scaled<br>expression';
  } else {
    // Replicate the gene's log2FC across all samples to fill the z matrix
    mainZ = plotData.logFCs.map(lfc => plotData.x.map(() => lfc));
    colorscale = colorblindMode
      ? ([[0, '#0072B2'], [0.5, '#f7f7f7'], [1, '#D55E00']] as [number, string][])
      : 'RdBu';
    zmin = -3;
    zmax = 3;
    colorbarTitle = 'Log2FC';
  }

  // Hover text matrix for main heatmap
  const hoverText = mainZ.map((row, rowIdx) =>
    row.map((value, colIdx) => {
      const geneId = plotData.y[rowIdx];
      const sample = plotData.x[colIdx];
      const meta = geneMetadata.get(geneId);
      let t = `<b>${geneId}</b><br>`;
      t += `Sample: ${sample}<br>`;
      if (displayMode === 'expression') {
        t += `Z-score: ${value.toFixed(2)}<br>`;
      } else {
        t += `Log2FC: ${value.toFixed(2)}<br>`;
      }
      if (meta) {
        t += `Log2FC: ${meta.logFC.toFixed(2)}<br>`;
        t += `padj: ${meta.padj.toExponential(2)}`;
      }
      t += '<extra></extra>';
      return t;
    })
  );

  // ---- Condition annotation track (above the heatmap columns) ----
  // Uses the sample→condition map already resolved by ComparisonDetail.
  const condPalette = getPalette(colorblindMode ? 'colorblind' : 'standard').categorical;
  const sampleConditions = plotData.x.map((s) => sampleConditionMap?.[s]);
  const hasConditions = sampleConditions.some((c) => c != null);
  const uniqueConds = Array.from(new Set(sampleConditions.filter((c): c is string => c != null)));
  const condColors = uniqueConds.map((_, i) => condPalette[i % condPalette.length]);
  const condIndex = new Map(uniqueConds.map((c, i) => [c, i]));
  // z encoded to the middle of each discrete band; NaN for samples without a condition
  const condTrackZ = [
    sampleConditions.map((c) =>
      c != null && condIndex.has(c) ? (condIndex.get(c)! + 0.5) / Math.max(uniqueConds.length, 1) : NaN
    ),
  ];

  // ---- CSV export of the (clustered) matrix in display order ----
  const exportMatrixCSV = () => {
    const header = ['gene', 'logFC', 'padj', ...plotData.x];
    const lines = [header.join(',')];
    mainZ.forEach((row, i) => {
      const geneId = plotData.y[i];
      const meta = geneMetadata.get(geneId);
      const cells = [
        geneId,
        meta ? meta.logFC : plotData.logFCs[i],
        meta ? meta.padj : '',
        ...row.map((v) => (Number.isFinite(v) ? v : '')),
      ];
      lines.push(cells.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deg_heatmap_${comparisonName}_${displayMode}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Multi-line title matching the reference figure style
  const dataLabel =
    displayMode === 'expression'
      ? 'scaled(z-score normalized expression)'
      : 'log2FC';
  const titleText = [
    `<b>${comparisonName}</b>`,
    `n° samples: ${nSamples}`,
    `DEGs: ${nDEGs} features`,
    `Data: ${dataLabel}`,
  ].join('<br>');

  return (
    <div className="flex flex-col gap-3">
      {/* Warning: no sample filter */}
      {!hasSampleFilter && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
          <span className="mt-0.5">⚠️</span>
          <span>
            <strong>Metadata file missing</strong> — samples are not filtered for this comparison.
            All matrix samples are displayed. Upload a metadata (sample design) file to restrict the view to the samples of <em>{comparisonName}</em>.
          </span>
        </div>
      )}
      {/* Controls bar */}
      <div className="flex items-center gap-6 flex-wrap bg-white rounded-lg border border-gray-200 px-4 py-2.5">
        <span className="text-sm font-medium text-gray-700">Displayed value:</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="degDisplayMode"
              value="expression"
              checked={displayMode === 'expression'}
              onChange={() => setDisplayMode('expression')}
              className="text-brand-primary"
            />
            <span className="text-sm text-gray-700">Normalized expression (z-score)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="degDisplayMode"
              value="log2fc"
              checked={displayMode === 'log2fc'}
              onChange={() => setDisplayMode('log2fc')}
              className="text-brand-primary"
            />
            <span className="text-sm text-gray-700">Log2FC</span>
          </label>
        </div>

        <div className="flex-1" />

        {isPreview && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Preview (loading full data…)
          </span>
        )}
        {loading && plotData && (
          <span className="text-xs text-purple-600 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating…
          </span>
        )}

        <button
          onClick={exportMatrixCSV}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
          title="Export the clustered matrix (genes × samples, in display order) as CSV"
        >
          <Download className="w-3.5 h-3.5" /> Export matrix (.csv)
        </button>

        <ColorblindToggle value={colorblindMode} onChange={setColorblindMode} />
      </div>

      {/* Plotly heatmap with DEG-status sidebar */}
      <div
        className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        style={{ height: Math.max(600, Math.min(nDEGs * 1.2 + 200, 900)) }}
      >
        <Plot
          data={[
            // ── Top track: sample condition annotation ────────────────────
            ...(hasConditions
              ? [{
                  type: 'heatmap',
                  z: condTrackZ,
                  x: plotData.x,
                  y: ['Condition'],
                  colorscale: discreteColorscale(condColors),
                  zmin: 0,
                  zmax: 1,
                  showscale: false,
                  hovertext: [plotData.x.map((s) => `${s}<br>Condition: ${sampleConditionMap?.[s] ?? '—'}`)],
                  hoverinfo: 'text',
                  xaxis: 'x',
                  yaxis: 'y2',
                } as unknown as Partial<PlotData>]
              : []),

            // ── Left sidebar: UP/DOWN status ──────────────────────────────
            {
              type: 'heatmap',
              z: degStatus.map(v => [v]),
              x: ['DEG'],
              y: plotData.y,
              colorscale: DEG_STATUS_COLORSCALE,
              zmin: -1,
              zmax: 1,
              showscale: false,
              hovertemplate:
                '%{y}<br>%{customdata}<extra></extra>',
              customdata: degStatus.map(v => [v === 1 ? 'UP ▲' : 'DOWN ▼']),
              xaxis: 'x2',
              yaxis: 'y',
            } as Partial<PlotData>,

            // ── Main expression / log2FC heatmap ─────────────────────────
            {
              type: 'heatmap',
              z: mainZ,
              x: plotData.x,
              y: plotData.y,
              colorscale,
              reversescale: false,
              zmin,
              zmax,
              showscale: true,
              hovertext: hoverText,
              hoverinfo: 'text',
              colorbar: {
                title: { text: colorbarTitle, side: 'right' },
                thickness: 15,
                len: 0.5,
                x: 1.02,
                tickfont: { size: 10 },
                titlefont: { size: 11 },
              },
              xaxis: 'x',
              yaxis: 'y',
            } as unknown as Partial<PlotData>,
          ]}
          layout={{
            autosize: true,
            // sidebar occupies ~4% of width, main heatmap the rest
            xaxis: {
              domain: [0.055, 1.0],
              tickangle: -45,
              side: 'bottom',
              tickfont: { size: 10 },
              showgrid: false,
              title: { text: '' },
              automargin: true,
            },
            xaxis2: {
              domain: [0.0, 0.045],
              showticklabels: false,
              showgrid: false,
              fixedrange: true,
            },
            yaxis: {
              autorange: 'reversed',
              showticklabels: false,
              ticks: '',
              showgrid: false,
              domain: hasConditions ? [0.0, 0.93] : [0.0, 1.0],
            },
            // Condition annotation track (thin row at the top, aligned to columns)
            yaxis2: {
              domain: [0.95, 1.0],
              showticklabels: false,
              ticks: '',
              showgrid: false,
              fixedrange: true,
            },
            title: {
              text: titleText,
              font: { size: 12, family: 'monospace' },
              x: 0.5,
              xanchor: 'center',
            },
            margin: { l: 55, r: 90, b: 120, t: 140 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
          } as Partial<Layout>}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
              format: 'png',
              filename: `deg_heatmap_${comparisonName}`,
              scale: 2,
            },
          }}
        />
      </div>

      {/* Legend strip */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-gray-600 bg-gray-50 rounded px-4 py-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#7B2D8B' }} />
          <span>DOWN-regulated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#3A7D44' }} />
          <span>UP-regulated</span>
        </div>
        {hasConditions && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">Condition:</span>
            {uniqueConds.map((c, i) => (
              <div key={c} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: condColors[i] }} />
                <span>{c}</span>
              </div>
            ))}
          </>
        )}
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">
          Comparison: <strong className="text-gray-700">{comparisonName}</strong> — {nSamples} samples, {nDEGs} DEGs
        </span>
      </div>
    </div>
  );
}
