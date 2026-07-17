'use client';

import { useCallback, useState } from 'react';
import api from '@/utils/api';

export type Quadrant = 'concordant' | 'discordant' | 'specific_a' | 'specific_b' | 'ns';

export interface ScatterPoint {
  gene: string;
  gene_id: string;
  logfc_a: number;
  logfc_b: number;
  padj_a: number | null;
  padj_b: number | null;
  quadrant: Quadrant;
}

export interface ContrastScatterResult {
  dataset_id: string;
  comparison_a: { label: string; comparison_name: string };
  comparison_b: { label: string; comparison_name: string };
  thresholds: { padj: number; logfc: number };
  counts: {
    concordant: number;
    discordant: number;
    specific_a: number;
    specific_b: number;
    ns: number;
    shared: number;
    only_a: number;
    only_b: number;
  };
  correlation: {
    pearson_r: number | null;
    pearson_p: number | null;
    spearman_r: number | null;
    spearman_p: number | null;
    n: number;
  };
  points: ScatterPoint[];
}

export interface ContrastRef {
  dataset_id: string;
  comparison_name: string;
  label: string;
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

/**
 * Fetch a gene-by-gene log2FC comparison between two contrasts (synchronous;
 * the backend query + correlation is sub-second).
 */
export function useContrastScatter(pathDatasetId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContrastScatterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (
      refA: ContrastRef,
      refB: ContrastRef,
      opts?: { padjThreshold?: number; logfcThreshold?: number }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.post(`/datasets/${pathDatasetId}/logfc-scatter`, {
          comparison_refs: [refA, refB],
          padj_threshold: opts?.padjThreshold ?? 0.05,
          logfc_threshold: opts?.logfcThreshold ?? 0.58,
        });
        setResult(resp.data);
      } catch (err: unknown) {
        const detail = (err as ApiErrorShape)?.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to compute contrast scatter');
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [pathDatasetId]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, run, reset };
}
