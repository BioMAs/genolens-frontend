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
  gene_ids?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Rows per export request. The endpoint accepts up to 100000 (`limit: le=100000`), but a wide
 * matrix at that size is a response of well over a hundred megabytes; smaller pages keep each
 * one bounded at the cost of a few more round trips.
 */
export const DATASET_EXPORT_PAGE_SIZE = 25000;

/**
 * Every row of a dataset matching `filters`, walked page by page, for exports.
 *
 * Called at click time rather than held by a query: a matrix can be tens of thousands of rows
 * wide by hundreds of samples, which has no business sitting in the cache.
 */
export async function fetchAllDatasetRows(
  datasetId: string,
  filters: Omit<DatasetFilters, 'limit' | 'offset'> = {},
  pageSize: number = DATASET_EXPORT_PAGE_SIZE
): Promise<DatasetQueryResponse['data']> {
  const rows: DatasetQueryResponse['data'] = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await api.post<DatasetQueryResponse>(`/datasets/${datasetId}/query`, {
      ...filters,
      limit: pageSize,
      offset,
    });
    const page = response.data.data ?? [];
    rows.push(...page);
    if (page.length < pageSize || rows.length >= response.data.total_rows) return rows;
  }
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
  [key: string]: unknown;
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
      // POST /query, not GET /data: the latter never existed on the backend and answered 404,
      // so the dataset page showed an error instead of its table.
      const response = await api.post<DatasetQueryResponse>(`/datasets/${datasetId}/query`, filters);
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
