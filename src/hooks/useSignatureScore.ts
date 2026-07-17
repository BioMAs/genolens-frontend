'use client';

import { useCallback, useState } from 'react';
import api from '@/utils/api';

export type ScoringMethod = 'mean_z' | 'mean_rank';

export interface SampleScore {
  sample: string;
  score: number;
  group: string | null;
}

export interface SignatureScoreResult {
  dataset_id: string;
  method: ScoringMethod;
  signature_name: string | null;
  n_genes_requested: number;
  n_genes_used: number;
  n_samples: number;
  scores: SampleScore[];
  groups: Record<string, number[]>;
  test: string | null;
  stat: number | null;
  pvalue: number | null;
}

interface RunArgs {
  geneListId?: string;
  genes?: string[];
  method: ScoringMethod;
  samples?: string[];
  sampleConditionMap?: Record<string, string>;
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

/**
 * Score a gene signature per sample on a MATRIX dataset and compare between
 * conditions (synchronous; a single matrix read + scoring).
 */
export function useSignatureScore(matrixDatasetId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignatureScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (args: RunArgs) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.post(`/datasets/${matrixDatasetId}/signature-score`, {
          gene_list_id: args.geneListId ?? null,
          genes: args.genes ?? null,
          method: args.method,
          samples: args.samples ?? null,
          sample_condition_map: args.sampleConditionMap ?? null,
        });
        setResult(resp.data);
      } catch (err: unknown) {
        const detail = (err as ApiErrorShape)?.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to score signature');
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [matrixDatasetId]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, run, reset };
}
