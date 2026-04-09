import { HeatmapConfig, TopNOption } from './types';

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
  height: 700,
  mainMargin: { l: 120, r: 50, b: 150, t: 60 },
  sidebarMargin: { l: 0, r: 0, b: 150, t: 60 },
  colorscale: 'RdBu',
  logFCColorscale: 'PiYG',
  zmin: -1,
  zmax: 1,
  logFCmin: -2,
  logFCmax: 2,
};

export const MODAL_HEATMAP_CONFIG: HeatmapConfig = {
  ...DEFAULT_HEATMAP_CONFIG,
  height: typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800,
  mainMargin: { l: 150, r: 80, b: 150, t: 80 },
};

export const MOBILE_HEATMAP_CONFIG: HeatmapConfig = {
  ...DEFAULT_HEATMAP_CONFIG,
  height: 500,
  mainMargin: { l: 100, r: 30, b: 100, t: 50 },
};

export const TOP_N_OPTIONS: TopNOption[] = [
  { value: 50, label: 'Top 50 Genes', description: 'Fast - Overview' },
  { value: 100, label: 'Top 100 Genes', description: 'Default - Balanced' },
  { value: 500, label: 'Top 500 Genes', description: 'Detailed - Main patterns' },
  { value: 1000, label: 'Top 1000 Genes', description: 'Very detailed' },
  { value: 2000, label: 'Top 2000 Genes', description: 'Complete - All patterns' },
  { value: 5000, label: 'All DEGs', description: 'Maximum (may be slow)' },
];

export const DEFAULT_CLUSTERING_PARAMS = {
  top_n_genes: 100,
  method: 'ward',
  metric: 'euclidean',
  cluster_rows: true,
  cluster_cols: true,
};

/**
 * Format gene info for tooltip
 */
export function formatGeneTooltip(
  geneId: string,
  sample: string,
  expression: number,
  logFC?: number,
  padj?: number
): string {
  let tooltip = `<b>${geneId}</b><br>`;
  tooltip += `Sample: ${sample}<br>`;
  tooltip += `Expression: ${expression.toFixed(2)}<br>`;
  if (logFC !== undefined) {
    tooltip += `LogFC: ${logFC.toFixed(2)}<br>`;
  }
  if (padj !== undefined) {
    tooltip += `padj: ${padj.toExponential(2)}<br>`;
  }
  tooltip += '<extra></extra>';
  return tooltip;
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  comparisonName: string,
  topN: number,
  format: 'png' | 'svg'
): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sanitizedName = comparisonName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `heatmap_${sanitizedName}_${topN}genes_${timestamp}.${format}`;
}
