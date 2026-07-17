'use client';

import { useCallback, useState } from 'react';
import api from '@/utils/api';

export interface GeneTrajectory {
  gene: string;
  values: number[]; // z per group, in `groups` order
}

export interface PatternCluster {
  id: number;
  n_genes: number;
  genes: string[];
  median: number[]; // median z per group
  gene_trajectories: GeneTrajectory[];
}

export interface DegPatternsResult {
  dataset_id: string;
  groups: string[];
  n_deg_requested: number;
  n_deg_used: number;
  n_genes_clustered: number;
  n_clusters: number;
  min_cluster_size: number;
  downsampled: boolean;
  clusters: PatternCluster[];
}

interface RunArgs {
  degDatasetId: string;
  comparisonName: string;
  sampleConditionMap?: Record<string, string>;
  groupOrder?: string[];
  nClusters: number;
  minClusterSize: number;
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

/** Cluster a comparison's DEGs by expression trajectory across conditions. */
export function useDegPatterns(matrixDatasetId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DegPatternsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (args: RunArgs) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.post(`/datasets/${matrixDatasetId}/deg-patterns`, {
          deg_dataset_id: args.degDatasetId,
          comparison_name: args.comparisonName,
          sample_condition_map: args.sampleConditionMap ?? null,
          group_order: args.groupOrder ?? null,
          n_clusters: args.nClusters,
          min_cluster_size: args.minClusterSize,
        });
        setResult(resp.data);
      } catch (err: unknown) {
        const detail = (err as ApiErrorShape)?.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to compute DEG patterns');
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [matrixDatasetId]
  );

  return { loading, result, error, run };
}
