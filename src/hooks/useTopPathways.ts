'use client';

/**
 * Les voies enrichies les plus fortes d'une comparaison.
 *
 * Reprend tel quel ce que `OverviewTopPathways` faisait dans un `useEffect` : lit les voies en
 * cache du dataset d'ENRICHISSEMENT (le même endpoint que l'onglet Enrichment, qui ne relance
 * donc aucun calcul), ne garde que `padj <= 0,05`, et y ajoute le sens de la voie.
 *
 * **Clé de cache.** `['enrichment-pathways', 'top', id, comparaison]` et non
 * `['enrichment-pathways', id, comparaison]` : cette dernière appartient déjà à
 * `useGeneToPathways`, qui y met la page brute de 1000 voies avec leurs gènes. Deux hooks, deux
 * formes de donnée, une clé : le second lecteur recevrait la forme du premier sans refetch, et
 * TypeScript ne le verrait pas. Le préfixe commun est gardé pour qu'une invalidation de
 * `['enrichment-pathways']` atteigne les deux. Les faire partager une même entrée demanderait
 * d'aligner leurs requêtes (ici 100 voies filtrées, là 1000 brutes) : c'est un chantier à part,
 * que `useGeneToPathways` annonce déjà.
 *
 * `n` n'est PAS dans la clé : on met en cache toutes les voies qui passent le seuil et on
 * tranche à la lecture, donc deux cartes qui n'en veulent pas autant partagent une requête.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export interface TopPathway {
  id: string;
  name: string;
  padj: number;
  geneCount: number;
  /**
   * Les symboles des gènes de la voie, tels que l'endpoint les sert (`genes`, le champ que
   * `useGeneToPathways` lit aussi) ; `[]` quand la ligne n'en porte pas. C'est ce qu'un clic sur
   * la voie passe à `focusTerm`.
   */
  genes: string[];
  /** Sens de la voie d'après `regulation` ; `null` pour l'enrichissement « tous les DEG ». */
  direction: 'up' | 'down' | null;
  category?: string;
}

/** Seuil de padj au-delà duquel une voie n'est plus montrée (aussi celui que les cartes affichent). */
export const TOP_PATHWAYS_PADJ_MAX = 0.05;

function toDirection(regulation: unknown): TopPathway['direction'] {
  const value = typeof regulation === 'string' ? regulation.toUpperCase() : '';
  if (value === 'UP') return 'up';
  if (value === 'DOWN') return 'down';
  return null;
}

function toGenes(genes: unknown): string[] {
  if (!Array.isArray(genes)) return [];
  return genes.filter((gene): gene is string => typeof gene === 'string' && gene !== '');
}

function parsePathway(row: Record<string, unknown>): TopPathway {
  return {
    id: row.pathway_id ? String(row.pathway_id) : '',
    name: row.pathway_name ? String(row.pathway_name) : String(row.description ?? '—'),
    padj: Number(row.padj ?? row.pvalue ?? 1),
    geneCount: Number(row.gene_count ?? 0),
    genes: toGenes(row.genes),
    direction: toDirection(row.regulation),
    ...(row.category ? { category: String(row.category) } : {}),
  };
}

export interface TopPathways {
  /**
   * `null` tant qu'il n'y a rien à montrer : pas d'enrichissement rattaché, réponse en route ou
   * échec (`isLoading` et `isError` départagent). `[]` quand la réponse est là et qu'aucune voie
   * ne passe le seuil.
   */
  pathways: TopPathway[] | null;
  isLoading: boolean;
  isError: boolean;
}

export function useTopPathways(
  enrichmentDatasetId: string | undefined,
  comparisonName: string,
  n: number = 7
): TopPathways {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['enrichment-pathways', 'top', enrichmentDatasetId, comparisonName],
    enabled: !!enrichmentDatasetId && !!comparisonName,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TopPathway[]> => {
      const res = await api.get(
        `/datasets/${enrichmentDatasetId}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
        {
          params: {
            regulation: 'ALL',
            page: 1,
            page_size: 100,
            padj_max: TOP_PATHWAYS_PADJ_MAX,
            sort_by: 'padj',
            sort_order: 'asc',
          },
        }
      );
      const rows: Record<string, unknown>[] = res.data?.pathways ?? [];
      return rows
        .map(parsePathway)
        .filter((p) => Number.isFinite(p.padj) && p.padj <= TOP_PATHWAYS_PADJ_MAX);
    },
  });

  const pathways = useMemo(() => (data ? data.slice(0, n) : null), [data, n]);

  return { pathways, isLoading, isError };
}
