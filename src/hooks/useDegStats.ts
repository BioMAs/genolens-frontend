import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

/**
 * Per-method DEG counts for a comparison.
 */
export interface MethodCounts {
  up: number;
  down: number;
  total: number;
}

/**
 * A single gene row with all per-method p-value / padj columns.
 *
 * Column names are dynamic and embed the comparison name, e.g.
 * `pvalue.Stouffer:CondA_vs_CondB`, `padj.DESeq2:CondA_vs_CondB`,
 * `log2FoldChange:CondA_vs_CondB`, plus boolean `is_sig.<Method>` flags.
 */
export type DegStatsRow = Record<string, string | number | boolean | null>;

export interface DegStatsResponse {
  /** Active-method per-comparison summary (Stouffer-first). */
  stats: Record<string, unknown>;
  /** { comparison: { method: { up, down, total } } } */
  general: Record<string, Record<string, MethodCounts>>;
  /** One record per gene, with every per-method pvalue/padj column. */
  individual: DegStatsRow[];
  /** { comparison: [method names available] } */
  available_methods: Record<string, string[]>;
}

/**
 * Fetch multi-method DEG statistics (per-method p-values + Stouffer) for a
 * single comparison. Backed by `GET /datasets/{id}/deg-stats?comparison=...`.
 */
export function useDegStats(
  datasetId: string,
  comparisonName: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['deg-stats', datasetId, comparisonName],
    queryFn: async () => {
      const response = await api.get<DegStatsResponse>(
        `/datasets/${datasetId}/deg-stats`,
        { params: { comparison: comparisonName } }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && !!comparisonName && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
