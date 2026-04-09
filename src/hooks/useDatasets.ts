import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { Dataset, DatasetQueryResponse } from '@/types';

/**
 * Interface pour les filtres de données de dataset
 */
export interface DatasetFilters {
  padj_max?: number;
  logfc_min?: number;
  logfc_max?: number;
  columns?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Interface pour les statistiques de dataset
 */
export interface DatasetStats {
  total_genes: number;
  deg_up?: number;
  deg_down?: number;
  deg_total?: number;
  mean_expression?: number;
  median_padj?: number;
  [key: string]: any;
}

/**
 * Interface pour les colonnes de dataset (endpoint optimisé)
 */
export interface DatasetColumns {
  columns: string[];
  column_types?: Record<string, string>;
  total_rows: number;
}

/**
 * Interface pour la liste de gènes (endpoint optimisé)
 */
export interface DatasetGenesList {
  genes: string[];
  total: number;
}

/**
 * Hook pour récupérer les métadonnées d'un dataset
 * Utilise le cache React Query avec staleTime de 5 minutes
 */
export function useDataset(datasetId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: async () => {
      const response = await api.get<Dataset>(`/datasets/${datasetId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (anciennement cacheTime)
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook pour récupérer uniquement le schéma des colonnes (endpoint optimisé)
 * Remplace les requêtes complètes avec limit: 100000
 * Réduction: 10 MB → 1 KB (~99%)
 */
export function useDatasetColumns(datasetId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'columns'],
    queryFn: async () => {
      const response = await api.get<DatasetColumns>(`/datasets/${datasetId}/columns`);
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - structure change rarement
    gcTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook pour récupérer les statistiques pré-calculées (endpoint optimisé)
 * Utilise les colonnes statistiques de la base de données
 * Réduction: 5-10 MB → <1 KB (~99.9%)
 */
export function useDatasetStats(
  datasetId: string,
  comparisonName?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'stats', comparisonName],
    queryFn: async () => {
      const params = comparisonName ? { comparison_name: comparisonName } : {};
      const response = await api.get<DatasetStats>(`/datasets/${datasetId}/stats`, { params });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook pour récupérer la liste des gènes (endpoint optimisé)
 * Retourne seulement les noms de gènes sans toutes les données
 * Réduction: 5-10 MB → 20-50 KB (~99%)
 */
export function useDatasetGenes(
  datasetId: string,
  filters?: { padj_max?: number; logfc_min?: number },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'genes', 'list', filters],
    queryFn: async () => {
      const response = await api.get<DatasetGenesList>(`/datasets/${datasetId}/genes/list`, {
        params: filters,
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook pour récupérer les données de dataset avec filtrage backend
 * Utilise le filtrage côté serveur pour réduire les transferts réseau
 * Supporte la pagination avec limit/offset
 */
export function useDatasetData(
  datasetId: string,
  filters: DatasetFilters = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'data', filters],
    queryFn: async () => {
      const response = await api.get<DatasetQueryResponse>(`/datasets/${datasetId}/data`, {
        params: filters,
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!datasetId && enabled,
    // Déduplication automatique des requêtes identiques
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook pour la requête traditionnelle de dataset (rétrocompatibilité)
 * À terme, migrer vers useDatasetData avec filtres
 */
export function useDatasetQuery(datasetId: string, limit: number = 500, enabled: boolean = true) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'query', limit],
    queryFn: async () => {
      const response = await api.post<DatasetQueryResponse>(`/datasets/${datasetId}/query`, { limit });
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - données changent rarement
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && enabled,
  });
}

/**
 * Hook utilitaire pour précharger les données d'un dataset au survol
 * Utilise queryClient.prefetchQuery pour un chargement anticipé
 */
export function usePrefetchDataset() {
  const queryClient = useQueryClient();

  return {
    prefetchDataset: (datasetId: string) => {
      queryClient.prefetchQuery({
        queryKey: ['dataset', datasetId],
        queryFn: async () => {
          const response = await api.get<Dataset>(`/datasets/${datasetId}`);
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      });
    },
    prefetchDatasetColumns: (datasetId: string) => {
      queryClient.prefetchQuery({
        queryKey: ['dataset', datasetId, 'columns'],
        queryFn: async () => {
          const response = await api.get<DatasetColumns>(`/datasets/${datasetId}/columns`);
          return response.data;
        },
        staleTime: 1000 * 60 * 10,
      });
    },
    prefetchDatasetStats: (datasetId: string, comparisonName?: string) => {
      const params = comparisonName ? { comparison_name: comparisonName } : {};
      queryClient.prefetchQuery({
        queryKey: ['dataset', datasetId, 'stats', comparisonName],
        queryFn: async () => {
          const response = await api.get<DatasetStats>(`/datasets/${datasetId}/stats`, { params });
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      });
    },
  };
}
