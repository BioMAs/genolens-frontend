'use client';

/**
 * Known interaction partners of one gene, from STRING.
 *
 * `POST /integrations/string/partners` has existed for a while, documented for exactly this —
 * "good for exploring a gene of interest directly from the DEG table" — and wired to nothing.
 * This is its first caller.
 *
 * The service returns the same shape as the network endpoint: the seed gene plus its partners
 * as nodes, and the edges between them. Partners are therefore the nodes that are not the seed,
 * ranked by the confidence of their edge to it.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { normalizeGeneKey } from '@/utils/geneKeys';

/** Default confidence floor, matching the endpoint's own default. */
export const DEFAULT_PARTNER_SCORE = 700;

export interface StringPartner {
  name: string;
  /** STRING's confidence in the interaction, 0–1. */
  score: number;
  annotation?: string;
}

interface RawNode {
  id?: string;
  name?: string;
  annotation?: string;
}

interface RawEdge {
  source?: string;
  target?: string;
  score?: number;
}

interface RawNetwork {
  nodes?: RawNode[];
  edges?: RawEdge[];
}

/** Nodes that are not the seed, carrying the score of their edge to it, strongest first. */
export function partnersFromNetwork(network: RawNetwork, seed: string): StringPartner[] {
  const seedKey = normalizeGeneKey(seed);
  const scoreByNode = new Map<string, number>();

  for (const edge of network.edges ?? []) {
    const source = normalizeGeneKey(edge.source);
    const target = normalizeGeneKey(edge.target);
    const other = source === seedKey ? target : target === seedKey ? source : null;
    if (!other) continue;
    const score = typeof edge.score === 'number' ? edge.score : 0;
    // STRING can report a pair more than once; keep the strongest.
    scoreByNode.set(other, Math.max(scoreByNode.get(other) ?? 0, score));
  }

  return (network.nodes ?? [])
    .map((node) => ({ node, key: normalizeGeneKey(node.name ?? node.id) }))
    .filter(({ key }) => key && key !== seedKey)
    .map(({ node, key }) => ({
      name: node.name ?? node.id ?? key,
      score: scoreByNode.get(key) ?? 0,
      annotation: node.annotation,
    }))
    .sort((a, b) => b.score - a.score);
}

export function useStringPartners(
  geneSymbol: string | null | undefined,
  options: { species?: number; requiredScore?: number; limit?: number; enabled?: boolean } = {}
) {
  const {
    species = 9606,
    requiredScore = DEFAULT_PARTNER_SCORE,
    limit = 12,
    enabled = true,
  } = options;
  const symbol = geneSymbol?.trim() || '';

  return useQuery<StringPartner[]>({
    queryKey: ['string-partners', symbol, species, requiredScore, limit],
    enabled: enabled && symbol.length > 0,
    // A third-party database that does not change while someone reads a comparison.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    // STRING is external and occasionally slow; one retry, then give up quietly.
    retry: 1,
    queryFn: async () => {
      const response = await api.post<RawNetwork>('/integrations/string/partners', {
        gene_symbol: symbol,
        species,
        required_score: requiredScore,
        limit,
      });
      return partnersFromNetwork(response.data ?? {}, symbol);
    },
  });
}
