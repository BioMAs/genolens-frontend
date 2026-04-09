import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { ClusteringParams, HeatmapData } from './types';

interface UseHeatmapDataProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
  params: ClusteringParams;
}

interface UseHeatmapDataReturn {
  loading: boolean;
  error: string | null;
  plotData: HeatmapData | null;
  geneMetadata: Map<string, { logFC: number; padj: number }>;
  refetch: () => void;
}

export function useHeatmapData({
  degDataset,
  matrixDataset,
  sampleIds,
  comparisonName,
  params,
}: UseHeatmapDataProps): UseHeatmapDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotData, setPlotData] = useState<HeatmapData | null>(null);
  const [geneMetadata, setGeneMetadata] = useState<Map<string, { logFC: number; padj: number }>>(
    new Map()
  );

  const fetchHeatmapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch DEGs with backend filtering
      let targetGenes: string[] | undefined = undefined;
      let degRows: any[] = [];
      let significant: any[] = [];

      const columnsInfo =
        degDataset.dataset_metadata?.columns_info?.comparisons?.[comparisonName] ||
        degDataset.dataset_metadata?.comparisons?.[comparisonName];

      if (!columnsInfo) {
        throw new Error('Comparison metadata not found');
      }

      const pValCol = columnsInfo.padj;
      const logFCCol = columnsInfo.logFC;

      // Fetch significant DEGs with backend filtering
      const degResponse = await api.post(`/datasets/${degDataset.id}/query`, {
        limit: 5000,
        padj_max: 0.05,
        logfc_min: 1.0,
        sort_by: logFCCol,
        sort_desc: true,
      });

      degRows = degResponse.data.data;
      significant = degRows;

      // Store gene metadata for tooltips
      const metadata = new Map<string, { logFC: number; padj: number }>();
      degRows.forEach((row: any) => {
        metadata.set(row['gene_id'], {
          logFC: parseFloat(row[logFCCol]),
          padj: parseFloat(row[pValCol]),
        });
      });
      setGeneMetadata(metadata);

      // Select top N genes
      if (params.top_n_genes === 0) {
        targetGenes = significant.map((r: any) => r['gene_id']);
      } else {
        targetGenes = significant.slice(0, params.top_n_genes).map((r: any) => r['gene_id']);
      }

      // 2. Split genes into UP and DOWN for better visual grouping
      let upGenes: string[] = [];
      let downGenes: string[] = [];

      if (targetGenes) {
        upGenes = significant
          .filter((r: any) => parseFloat(r[logFCCol]) > 0)
          .slice(0, Math.ceil(params.top_n_genes / 2) + 1000)
          .map((r: any) => r['gene_id']);

        downGenes = significant
          .filter((r: any) => parseFloat(r[logFCCol]) < 0)
          .slice(0, Math.ceil(params.top_n_genes / 2) + 1000)
          .map((r: any) => r['gene_id']);

        // Limit total count to requested top_n_genes
        const limit = params.top_n_genes;
        if (upGenes.length + downGenes.length > limit) {
          upGenes = upGenes.slice(0, limit / 2);
          downGenes = downGenes.slice(0, limit / 2);
        }
      }

      if (upGenes.length === 0 && downGenes.length === 0) {
        setError('No significant DEGs found.');
        setLoading(false);
        return;
      }

      // 3. Request clustering from backend (parallel for UP and DOWN)
      const [upResult, downResult] = await Promise.all([
        upGenes.length > 0
          ? api.post(`/datasets/${matrixDataset.id}/cluster`, {
              ...params,
              gene_ids: upGenes,
              top_n_genes: upGenes.length,
            })
          : Promise.resolve({ data: null }),
        downGenes.length > 0
          ? api.post(`/datasets/${matrixDataset.id}/cluster`, {
              ...params,
              gene_ids: downGenes,
              top_n_genes: downGenes.length,
            })
          : Promise.resolve({ data: null }),
      ]);

      // 4. Merge and align results
      const primaryResult = upResult.data || downResult.data;
      if (!primaryResult) {
        setError('Failed to cluster data');
        setLoading(false);
        return;
      }

      const colOrder = primaryResult.col_order;
      const colLabels = primaryResult.col_labels;

      // Helper to process and align a clustering chunk
      const processChunk = (res: any) => {
        if (!res || !res.data) return { z: [], y: [] };

        const currentCols = res.col_labels;
        const primaryColLabels = colOrder.map((i: number) => colLabels[i]);

        // Map sample names to their indices in this chunk
        const colMap = new Map();
        currentCols.forEach((c: string, i: number) => colMap.set(c, i));

        // Align columns to match primary result order
        const alignIndices = primaryColLabels.map((name: string) => colMap.get(name));

        const z = res.data;
        const y = res.row_labels;
        const row_order = res.row_order;

        // Reorder rows and align columns
        const alignedRows = row_order.map((i: number) => {
          return alignIndices.map((j: number) => z[i][j]);
        });

        const orderedY = row_order.map((i: number) => y[i]);

        return { z: alignedRows, y: orderedY };
      };

      const upData = processChunk(upResult.data);
      const downData = processChunk(downResult.data);

      // Concatenate: UP genes first, then DOWN genes
      const finalZRaw = [...upData.z, ...downData.z];
      const finalY = [...upData.y, ...downData.y];
      const finalX = colOrder.map((i: number) => colLabels[i]);

      // 5. Compute normalized relative expression (range -1 to 1)
      const orderedZ = finalZRaw.map((row: number[]) => {
        const mean = row.reduce((a, b) => a + b, 0) / row.length;
        const centered = row.map((v) => v - mean);
        const maxAbs = Math.max(...centered.map(Math.abs)) || 1;
        return centered.map((v) => v / maxAbs);
      });

      // 6. Extract LogFC for each gene (for sidebar)
      const geneLogFCMap = new Map();
      degRows.forEach((r: any) => geneLogFCMap.set(r['gene_id'], parseFloat(r[logFCCol])));
      const logFCs = finalY.map((gene: string) => geneLogFCMap.get(gene) || 0);

      setPlotData({
        z: orderedZ,
        x: finalX,
        y: finalY,
        logFCs: logFCs,
        type: 'clustering',
      });
    } catch (err: any) {
      console.error('Heatmap error:', err);
      setError(err.message || 'Failed to load heatmap');
    } finally {
      setLoading(false);
    }
  }, [degDataset, matrixDataset, sampleIds, comparisonName, params]);

  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  return {
    loading,
    error,
    plotData,
    geneMetadata,
    refetch: fetchHeatmapData,
  };
}
