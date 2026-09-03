'use client';

/**
 * The protein-interaction network of a set of genes.
 *
 * The panel this replaces held the request in local `useState` with hand-rolled loading and
 * error flags — the outlier in this folder, since the GEO half already had `useGeo`.
 *
 * **Not** `POST /integrations/cytoscape/cytoscapejs`, despite its name. That route is an export
 * converter: `CytoscapeExportRequest` requires the network *in the request body*, so calling it
 * means already holding what you wanted, and its payload carries only `{id, label, annotation,
 * string_id}` per node — no regulation, no fold change. The colour encoding needs a client-side
 * join either way, so this fetches the network once and joins here. Those export routes keep
 * their real job: the "open in Cytoscape Desktop / NDEx" buttons.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import type { PPINetwork } from '@/types/network';
import { clampSymbols, MAX_SEED_GENES } from '@/components/network/cytoscapeAdapters';

/** Human, 9606. Kept as the default the endpoint itself uses. */
export const DEFAULT_SPECIES = 9606;

export interface StringNetworkParams {
  symbols: string[];
  species?: number;
  /** STRING confidence floor, 0–1000. */
  requiredScore?: number;
  /**
   * Partners to pull in per seed gene.
   *
   * The endpoint declares `ge=1`, so there is no "seeds only" value — asking for zero is a 422.
   * One is the floor.
   */
  limit?: number;
  enabled?: boolean;
}

export interface StringNetworkResult extends PPINetwork {
  /** Symbols actually sent, after the server's hundred-gene cap. */
  requested: string[];
  /** How many were dropped to fit, so the panel can say so. */
  dropped: number;
}

export function useStringNetwork({
  symbols,
  species = DEFAULT_SPECIES,
  requiredScore = 700,
  limit = 10,
  enabled = true,
}: StringNetworkParams) {
  const requested = clampSymbols(symbols);
  const dropped = Math.max(0, symbols.length - requested.length);

  return useQuery<StringNetworkResult>({
    queryKey: ['string-network', requested, species, requiredScore, limit],
    enabled: enabled && requested.length > 0,
    // STRING is a third-party database; it does not move while a comparison is being read.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const response = await api.post<PPINetwork>('/integrations/string/network', {
        gene_symbols: requested,
        species,
        required_score: requiredScore,
        limit,
      });
      const data = response.data ?? { nodes: [], edges: [] };
      return {
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        species: data.species,
        count: data.count,
        requested,
        dropped,
      };
    },
  });
}

export { MAX_SEED_GENES };
