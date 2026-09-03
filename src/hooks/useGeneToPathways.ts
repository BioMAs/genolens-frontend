'use client';

/**
 * Which enriched pathways contain a given gene.
 *
 * Every enrichment payload already carries `genes` per pathway, so this needs no endpoint of
 * its own — the mapping is an inverted index over data the API hands out anyway.
 *
 * It is **not** free, though, and the plan that called for it was optimistic on that point:
 * neither `GOEnrichmentAnalysis` nor `OverviewTopPathways` fetches through React Query, so
 * there is no shared cache entry to piggyback on. This owns its query instead, and pays for it
 * once per comparison — deferred until a gene is actually focused, so simply arriving on the
 * Explorer screen costs nothing. Converting those two callers onto this hook would make it
 * genuinely shared; that is a follow-up, not a prerequisite.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { normalizeGeneKey } from '@/utils/geneKeys';

export interface EnrichedPathway {
  id: string;
  name: string;
  padj: number | null;
  category?: string;
  geneCount: number;
}

interface RawPathway {
  pathway_id?: string;
  pathway_name?: string;
  padj?: number | null;
  category?: string;
  gene_count?: number;
  genes?: string[];
}

/** `normalised gene -> pathways containing it`, most significant first. */
export type GeneToPathways = Map<string, EnrichedPathway[]>;

/** Build the inverted index. Pure, so the index shape can be tested without a fetch. */
export function invertPathways(rows: RawPathway[]): GeneToPathways {
  const index: GeneToPathways = new Map();

  const sorted = [...rows].sort((a, b) => {
    // A null padj sorts last rather than winning by accident.
    const left = a.padj ?? Number.POSITIVE_INFINITY;
    const right = b.padj ?? Number.POSITIVE_INFINITY;
    return left - right;
  });

  for (const row of sorted) {
    const pathway: EnrichedPathway = {
      id: row.pathway_id ?? row.pathway_name ?? '',
      name: row.pathway_name ?? row.pathway_id ?? '',
      padj: row.padj ?? null,
      category: row.category,
      geneCount: row.gene_count ?? row.genes?.length ?? 0,
    };
    if (!pathway.id) continue;

    for (const gene of row.genes ?? []) {
      const key = normalizeGeneKey(gene);
      if (!key) continue;
      const existing = index.get(key);
      if (existing) existing.push(pathway);
      else index.set(key, [pathway]);
    }
  }

  return index;
}

interface Params {
  enrichmentDatasetId: string | undefined;
  comparisonName: string;
  /** Only fetch once there is a gene to answer about. */
  enabled: boolean;
}

export function useGeneToPathways({ enrichmentDatasetId, comparisonName, enabled }: Params) {
  const query = useQuery<RawPathway[]>({
    queryKey: ['enrichment-pathways', enrichmentDatasetId, comparisonName],
    enabled: enabled && !!enrichmentDatasetId && !!comparisonName,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    // A comparison with no enrichment attached is a normal state, not a failure worth retrying.
    retry: 0,
    queryFn: async () => {
      const response = await api.get(
        `/datasets/${enrichmentDatasetId}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
        { params: { page_size: 1000 } }
      );
      const data = response.data;
      const rows: RawPathway[] = data?.pathways ?? data?.results ?? data ?? [];
      return Array.isArray(rows) ? rows : [];
    },
  });

  const index = useMemo(() => invertPathways(query.data ?? []), [query.data]);

  return { ...query, index };
}
