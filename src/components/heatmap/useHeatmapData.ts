import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { ClusteringParams, HeatmapData } from './types';

const PREVIEW_GENES = 25; // genes per group (UP + DOWN) for instant preview

/** A gene the caller already knows about, standing in for one the hook would have discovered. */
export interface HeatmapGeneRow {
  gene_id: string;
  logFC: number;
  padj: number;
}

interface UseHeatmapDataProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
  params: ClusteringParams;
  /**
   * Genes to plot instead of discovering them.
   *
   * The endpoint always accepted explicit `up_gene_ids` / `down_gene_ids`; only the *discovery*
   * was hard-coded here, bounded by `padj_max: 0.05` and `logfc_min: 1.0`. So a caller who
   * already knows which genes it wants — a lasso, a pathway, a saved list — had no way to say
   * so, even though the server would have obliged.
   *
   * Rows rather than two gene lists on purpose: everything downstream — the tooltip metadata,
   * the UP/DOWN split, the top-N limit, the logFC sidebar — is built from these, so supplying
   * them substitutes for the discovery and changes nothing else.
   */
  genesOverride?: HeatmapGeneRow[];
}

interface UseHeatmapDataReturn {
  loading: boolean;
  error: string | null;
  plotData: HeatmapData | null;
  geneMetadata: Map<string, { logFC: number; padj: number }>;
  isPreview: boolean;
  refetch: () => void;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

type LooseRow = Record<string, unknown>;

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function useHeatmapData({
  degDataset,
  matrixDataset,
  sampleIds,
  comparisonName,
  params,
  genesOverride,
}: UseHeatmapDataProps): UseHeatmapDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotData, setPlotData] = useState<HeatmapData | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [geneMetadata, setGeneMetadata] = useState<Map<string, { logFC: number; padj: number }>>(
    new Map()
  );

  const fetchHeatmapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // --- 1. Fetch significant DEGs ---
      // Strategy A: use the /deg-genes/{comparison} DB endpoint (handles prefixed columns,
      // multi-comparison datasets, and self-service analyses reliably).
      // Strategy B: fall back to /query (Parquet) for legacy single-comparison datasets
      // where deg_genes table may be empty.

      let degRows: HeatmapGeneRow[] = [];

      // The caller knows which genes it wants, so neither strategy runs.
      if (genesOverride && genesOverride.length > 0) {
        degRows = genesOverride;
      }

      // --- Strategy A: DB deg-genes endpoint ---
      if (degRows.length === 0) {
        try {
          const dbResp = await api.get(
            `/datasets/${degDataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`,
            {
              params: {
                padj_max: 0.05,
                logfc_min: 1.0,
                sort_by: 'padj',
                sort_order: 'asc',
                page: 1,
                page_size: 5000,
              },
            }
          );
          const genes = (dbResp.data.genes ?? []) as LooseRow[];
          if (genes.length > 0) {
            degRows = genes.map((g) => ({
              gene_id: toStringValue(g.gene_id),
              // The DB stores the field as log_fc; normalise to logFC here
              logFC: toNumber(g.log_fc ?? g.logFC ?? g.log2FoldChange, 0),
              padj: toNumber(g.padj, 1),
            }));
          }
        } catch {
          // Endpoint absent or no data → fall through to Strategy B
        }
      }

      // --- Strategy B: Parquet /query fallback ---
      if (degRows.length === 0) {
        const datasetMetadata = degDataset.dataset_metadata as Record<string, unknown> | undefined;
        const comparisons =
          datasetMetadata?.comparisons &&
          typeof datasetMetadata.comparisons === 'object' &&
          !Array.isArray(datasetMetadata.comparisons)
            ? (datasetMetadata.comparisons as Record<string, Record<string, unknown>>)
            : undefined;

        const columnsInfoComparisons =
          datasetMetadata?.columns_info &&
          typeof datasetMetadata.columns_info === 'object' &&
          !Array.isArray(datasetMetadata.columns_info) &&
          (datasetMetadata.columns_info as Record<string, unknown>).comparisons &&
          typeof (datasetMetadata.columns_info as Record<string, unknown>).comparisons === 'object' &&
          !Array.isArray((datasetMetadata.columns_info as Record<string, unknown>).comparisons)
            ? ((datasetMetadata.columns_info as Record<string, unknown>).comparisons as Record<string, Record<string, unknown>>)
            : undefined;

        const columnsInfo = columnsInfoComparisons?.[comparisonName] || comparisons?.[comparisonName];

        const logFCCol: string =
          (typeof columnsInfo?.logFC === 'string' ? columnsInfo.logFC : undefined) ||
          degDataset.column_mapping?.log_fc ||
          degDataset.column_mapping?.log2FoldChange ||
          'log2FoldChange';
        const pValCol: string =
          (typeof columnsInfo?.padj === 'string' ? columnsInfo.padj : undefined) ||
          degDataset.column_mapping?.padj ||
          'padj';

        const safeLogFCCol = /^[a-zA-Z0-9_.:/\-]+$/.test(logFCCol) ? logFCCol : undefined;
        const queryResp = await api.post(`/datasets/${degDataset.id}/query`, {
          limit: 5000,
          padj_max: 0.05,
          logfc_min: 1.0,
          ...(safeLogFCCol ? { sort_by: safeLogFCCol, sort_desc: true } : {}),
        });

        const rawRows = (queryResp.data.data ?? []) as LooseRow[];
        const returnedColumns: string[] = queryResp.data.columns ?? [];

        // Detect prefixed column names (e.g. logFC:comparisonName, padj:comparisonName)
        const prefixedLogFCCol = returnedColumns.find(
          c => c.startsWith('logFC:') || c.startsWith('log2FoldChange:')
        );
        const prefixedPadjCol = returnedColumns.find(c => c.startsWith('padj:'));

        const detectedLogFCCol =
          ['logFC', 'log2FoldChange', 'log2fc', 'log_fc'].find(c => returnedColumns.includes(c)) ||
          prefixedLogFCCol ||
          logFCCol;
        const detectedPadjCol =
          ['padj', 'FDR', 'adj.P.Val'].find(c => returnedColumns.includes(c)) ||
          prefixedPadjCol ||
          pValCol;

        degRows = rawRows
          .filter((r) => {
            const lfc = toNumber(r[detectedLogFCCol], Number.NaN);
            const p = toNumber(r[detectedPadjCol], Number.NaN);
            return !isNaN(lfc) && !isNaN(p);
          })
          .map((r) => ({
            gene_id: toStringValue(r.gene_id),
            logFC: toNumber(r[detectedLogFCCol], 0),
            padj: toNumber(r[detectedPadjCol], 1),
          }));
      }

      if (degRows.length === 0) {
        setError(
          genesOverride
            ? 'None of the selected genes is in the expression matrix.'
            : 'No significant DEGs found.'
        );
        setLoading(false);
        return;
      }

      // Store gene metadata for tooltips
      const metadata = new Map<string, { logFC: number; padj: number }>();
      degRows.forEach(row => {
        metadata.set(row.gene_id, { logFC: row.logFC, padj: row.padj });
      });
      setGeneMetadata(metadata);

      // Split into UP / DOWN
      const limit = params.top_n_genes > 0 ? params.top_n_genes : degRows.length;
      const upAll = degRows.filter(r => r.logFC > 0);
      const downAll = degRows.filter(r => r.logFC < 0);

      const upFull = upAll.slice(0, Math.ceil(limit / 2)).map(r => r.gene_id);
      const downFull = downAll.slice(0, Math.floor(limit / 2)).map(r => r.gene_id);

      if (upFull.length === 0 && downFull.length === 0) {
        setError('No significant DEGs found (could not detect logFC column in response).');
        setLoading(false);
        return;
      }

      // LogFC sidebar lookup
      const geneLogFCMap = new Map<string, number>();
      degRows.forEach(r => geneLogFCMap.set(r.gene_id, r.logFC));

      // --- Helper: call combined endpoint and convert response to HeatmapData ---
      const callClusterHeatmap = async (
        upGenes: string[],
        downGenes: string[]
      ): Promise<HeatmapData> => {
        const res = await api.post(`/datasets/${matrixDataset.id}/cluster-heatmap`, {
          up_gene_ids: upGenes,
          down_gene_ids: downGenes,
          ...(sampleIds && sampleIds.length > 0 ? { sample_ids: sampleIds } : {}),
          method: params.method,
          metric: params.metric,
          cluster_rows: params.cluster_rows,
          cluster_cols: params.cluster_cols,
          max_genes_for_clustering: 2000,
        });

        const data = res.data;
        const x: string[] = data.x ?? [];

        // Concatenate UP then DOWN rows (already z-scored by backend)
        const upZ: number[][] = data.up?.z ?? [];
        const upY: string[] = data.up?.y ?? [];
        const downZ: number[][] = data.down?.z ?? [];
        const downY: string[] = data.down?.y ?? [];

        const finalZ = [...upZ, ...downZ];
        const finalY = [...upY, ...downY];
        const logFCs = finalY.map((gene: string) => geneLogFCMap.get(gene) ?? 0);

        return { z: finalZ, x, y: finalY, logFCs, type: 'clustering' };
      };

      // --- 2. Preview pass: first 25 UP + 25 DOWN for instant display ---
      const upPreview = upFull.slice(0, PREVIEW_GENES);
      const downPreview = downFull.slice(0, PREVIEW_GENES);

      const previewData = await callClusterHeatmap(upPreview, downPreview);
      setPlotData(previewData);
      setIsPreview(true);
      setLoading(false);

      // --- 3. Full pass in background (only if there are more genes) ---
      const needsFullLoad =
        upFull.length > PREVIEW_GENES || downFull.length > PREVIEW_GENES;

      if (needsFullLoad) {
        try {
          const fullData = await callClusterHeatmap(upFull, downFull);
          setPlotData(fullData);
        } catch (fullErr) {
          // Keep showing the preview; only log the error
          console.warn('Full heatmap load failed, keeping preview:', fullErr);
        } finally {
          setIsPreview(false);
        }
      } else {
        setIsPreview(false);
      }
    } catch (err: unknown) {
      console.error('Heatmap error:', err);
      const typedErr = err as ApiError;
      const detail = typedErr.response?.data?.detail;
      setError(detail || typedErr.message || 'Failed to load heatmap');
      setLoading(false);
    }
  }, [degDataset, matrixDataset, sampleIds, comparisonName, params, genesOverride]);

  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  return {
    loading,
    error,
    plotData,
    geneMetadata,
    isPreview,
    refetch: fetchHeatmapData,
  };
}
