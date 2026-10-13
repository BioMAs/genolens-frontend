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
import type { PPINetwork, SpeciesSource } from '@/types/network';
import { clampSymbols, MAX_SEED_GENES } from '@/components/network/cytoscapeAdapters';

/** Human, 9606. Kept as the default the endpoint itself uses. */
export const DEFAULT_SPECIES = 9606;

export interface StringNetworkParams {
  symbols: string[];
  /** NCBI taxon. With `datasetId`, only the fallback for a dataset that records no species. */
  species?: number;
  /**
   * The dataset the genes come from. The server then asks STRING about the species its analysis
   * was launched with — which lives in the analysis parameters, out of the client's reach.
   */
  datasetId?: string;
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

/**
 * A STRING failure the backend reported inside a 200.
 *
 * The endpoint never fails as HTTP for an upstream problem: it answers `{nodes: [], edges: [],
 * error}`. Read as data, that empty network painted "no interaction at this confidence" over a
 * genuine failure — most often STRING's 404 for identifiers it does not know. Thrown instead, so
 * the panel can say what actually happened.
 */
export class StringNetworkError extends Error {
  constructor(
    /** `not-found`: STRING recognised none of the genes. `unreachable`: anything else. */
    readonly kind: 'not-found' | 'unreachable',
    message: string,
    /** The taxon STRING was asked about, so "none recognised" can name the organism. */
    readonly species?: number,
    readonly speciesSource?: SpeciesSource
  ) {
    super(message);
    this.name = 'StringNetworkError';
  }
}

function toStringError(data: PPINetwork & { error: string }): StringNetworkError {
  const { error } = data;
  const notFound = error === 'not_found' || /\b404\b/.test(error);
  return new StringNetworkError(
    notFound ? 'not-found' : 'unreachable',
    error,
    data.species,
    data.species_source
  );
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
  datasetId,
  requiredScore = 700,
  limit = 10,
  enabled = true,
}: StringNetworkParams) {
  const requested = clampSymbols(symbols);
  const dropped = Math.max(0, symbols.length - requested.length);

  return useQuery<StringNetworkResult>({
    queryKey: ['string-network', requested, species, datasetId ?? null, requiredScore, limit],
    enabled: enabled && requested.length > 0,
    // STRING is a third-party database; it does not move while a comparison is being read.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    // Asking again for genes STRING does not know returns the same 404.
    retry: (failures, error) =>
      !(error instanceof StringNetworkError && error.kind === 'not-found') && failures < 1,
    queryFn: async () => {
      const response = await api.post<PPINetwork & { error?: string }>(
        '/integrations/string/network',
        {
          gene_symbols: requested,
          species,
          ...(datasetId ? { dataset_id: datasetId } : {}),
          required_score: requiredScore,
          limit,
        }
      );
      const data = response.data ?? { nodes: [], edges: [] };
      if (data.error) throw toStringError({ ...data, error: data.error });
      return {
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        species: data.species,
        species_source: data.species_source,
        count: data.count,
        requested,
        dropped,
      };
    },
  });
}

export { MAX_SEED_GENES };
