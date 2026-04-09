import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

/**
 * Interface pour une comparaison
 */
export interface Comparison {
  id?: string;
  dataset_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface pour les statistiques d'une comparaison
 */
export interface ComparisonStats {
  total_genes: number;
  deg_up: number;
  deg_down: number;
  deg_total: number;
  significant_genes: number;
  mean_logfc?: number;
  median_padj?: number;
  has_enrichment?: boolean;
}

/**
 * Interface pour un gène différentiellement exprimé
 */
export interface DEGene {
  gene_id: string;
  gene_name?: string;
  log2FoldChange: number;
  pvalue: number;
  padj: number;
  baseMean?: number;
  regulation: 'up' | 'down' | 'not significant';
}

/**
 * Interface pour les filtres de DEGs
 */
export interface DEGFilters {
  padj_max?: number;
  logfc_min?: number;
  logfc_max?: number;
  regulation?: 'up' | 'down' | 'both';
  limit?: number;
  offset?: number;
  sort_by?: 'padj' | 'logfc' | 'gene_name';
  sort_order?: 'asc' | 'desc';
}

/**
 * Interface pour la réponse paginée de DEGs
 */
export interface DEGsResponse {
  genes: DEGene[];
  total: number;
  page: number;
  page_size: number;
  stats: ComparisonStats;
}

/**
 * Hook pour récupérer les métadonnées d'une comparaison
 */
export function useComparison(
  datasetId: string,
  comparisonName: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['comparison', datasetId, comparisonName],
    queryFn: async () => {
      const response = await api.get<Comparison>(
        `/datasets/${datasetId}/comparisons/${comparisonName}`
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && !!comparisonName && enabled,
  });
}

/**
 * Hook pour récupérer les statistiques pré-calculées d'une comparaison
 * Utilise l'endpoint optimisé /stats qui lit directement les colonnes statistiques
 * Performance: <1ms vs 500-5000ms pour recalcul complet
 */
export function useComparisonStats(
  datasetId: string,
  comparisonName: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['comparison', datasetId, comparisonName, 'stats'],
    queryFn: async () => {
      const response = await api.get<ComparisonStats>(
        `/datasets/${datasetId}/stats`,
        { params: { comparison_name: comparisonName } }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - stats changent rarement
    gcTime: 1000 * 60 * 15, // 15 minutes
    enabled: !!datasetId && !!comparisonName && enabled,
    // Pas de refetch car données statiques
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook pour récupérer la liste des gènes différentiellement exprimés (DEGs)
 * Support filtrage backend et pagination pour optimiser le transfert réseau
 */
export function useComparisonDEGs(
  datasetId: string,
  comparisonName: string,
  filters: DEGFilters = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['comparison', datasetId, comparisonName, 'degs', filters],
    queryFn: async () => {
      const response = await api.get<DEGsResponse>(
        `/datasets/${datasetId}/comparisons/${comparisonName}/degs`,
        { params: filters }
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

/**
 * Hook pour récupérer la liste simple des noms de gènes (endpoint optimisé)
 * Utilise /genes/list qui retourne seulement les noms sans toutes les colonnes
 * Réduction: 5-10 MB → 20-50 KB (~99%)
 */
export function useComparisonGenesList(
  datasetId: string,
  comparisonName: string,
  filters: { padj_max?: number; logfc_min?: number } = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['comparison', datasetId, comparisonName, 'genes-list', filters],
    queryFn: async () => {
      const response = await api.get<{ genes: string[]; total: number }>(
        `/datasets/${datasetId}/genes/list`,
        {
          params: {
            comparison_name: comparisonName,
            ...filters,
          },
        }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && !!comparisonName && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook pour récupérer toutes les comparaisons d'un dataset
 */
export function useDatasetComparisons(
  datasetId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'comparisons'],
    queryFn: async () => {
      const response = await api.get<Comparison[]>(
        `/datasets/${datasetId}/comparisons`
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook pour l'analyse multi-comparaisons
 * Récupère les DEGs de plusieurs comparaisons pour analyse Venn, heatmap, etc.
 */
export function useMultiComparison(
  datasetId: string,
  comparisonNames: string[],
  filters: DEGFilters = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['multi-comparison', datasetId, comparisonNames, filters],
    queryFn: async () => {
      const response = await api.post(
        `/datasets/${datasetId}/multi-comparison`,
        {
          comparison_names: comparisonNames,
          filters,
        }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && comparisonNames.length > 0 && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hooks utilitaires pour précharger les données de comparaisons
 * Utilisé pour améliorer l'UX lors du survol ou de la navigation
 */
export function usePrefetchComparisons() {
  const queryClient = useQueryClient();

  return {
    /**
     * Précharge les métadonnées d'une comparaison
     */
    prefetchComparison: (datasetId: string, comparisonName: string) => {
      queryClient.prefetchQuery({
        queryKey: ['comparison', datasetId, comparisonName],
        queryFn: async () => {
          const response = await api.get<Comparison>(
            `/datasets/${datasetId}/comparisons/${comparisonName}`
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      });
    },

    /**
     * Précharge les statistiques d'une comparaison (endpoint rapide)
     */
    prefetchComparisonStats: (datasetId: string, comparisonName: string) => {
      queryClient.prefetchQuery({
        queryKey: ['comparison', datasetId, comparisonName, 'stats'],
        queryFn: async () => {
          const response = await api.get<ComparisonStats>(
            `/datasets/${datasetId}/stats`,
            { params: { comparison_name: comparisonName } }
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      });
    },

    /**
     * Précharge la liste des gènes (endpoint optimisé)
     */
    prefetchGenesList: (
      datasetId: string,
      comparisonName: string,
      filters: { padj_max?: number; logfc_min?: number } = {}
    ) => {
      queryClient.prefetchQuery({
        queryKey: ['comparison', datasetId, comparisonName, 'genes-list', filters],
        queryFn: async () => {
          const response = await api.get<{ genes: string[]; total: number }>(
            `/datasets/${datasetId}/genes/list`,
            { params: { comparison_name: comparisonName, ...filters } }
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 10,
      });
    },

    /**
     * Précharge toutes les données critiques d'une comparaison
     * Appel unique pour charger stats + genes list en parallèle
     */
    prefetchComparisonData: async (datasetId: string, comparisonName: string) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['comparison', datasetId, comparisonName, 'stats'],
          queryFn: async () => {
            const response = await api.get<ComparisonStats>(
              `/datasets/${datasetId}/stats`,
              { params: { comparison_name: comparisonName } }
            );
            return response.data;
          },
        }),
        queryClient.prefetchQuery({
          queryKey: ['comparison', datasetId, comparisonName, 'genes-list', {}],
          queryFn: async () => {
            const response = await api.get<{ genes: string[]; total: number }>(
              `/datasets/${datasetId}/genes/list`,
              { params: { comparison_name: comparisonName } }
            );
            return response.data;
          },
        }),
      ]);
    },
  };
}
