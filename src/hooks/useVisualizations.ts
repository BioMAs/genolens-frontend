import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

/**
 * Interface pour les paramètres du volcano plot
 */
export interface VolcanoPlotParams {
  padj_threshold?: number;
  logfc_threshold?: number;
  top_n?: number;
}

/**
 * Interface pour les données du volcano plot
 */
export interface VolcanoPlotData {
  genes: string[];
  log2FoldChange: number[];
  padj: number[];
  significant: boolean[];
  labels?: string[];
}

/**
 * Interface pour les paramètres de clustering
 */
export interface ClusteringParams {
  method?: 'kmeans' | 'hierarchical' | 'dbscan';
  n_clusters?: number;
  metric?: 'euclidean' | 'correlation' | 'cosine';
  linkage?: 'ward' | 'complete' | 'average';
  max_genes?: number;
  padj_max?: number;
  logfc_min?: number;
  use_sorting?: boolean; // Option pour tri simple au lieu de clustering
}

/**
 * Interface pour les résultats de clustering/heatmap
 */
export interface ClusteringResult {
  gene_order: string[];
  sample_order: string[];
  clusters?: number[];
  expression_matrix?: number[][];
  gene_names?: string[];
  sample_names?: string[];
}

/**
 * Interface pour les données PCA
 */
export interface PCAData {
  pc1: number[];
  pc2: number[];
  pc3?: number[];
  explained_variance: number[];
  sample_names: string[];
  groups?: string[];
}

/**
 * Interface pour les données UMAP
 */
export interface UMAPData {
  umap1: number[];
  umap2: number[];
  sample_names: string[];
  groups?: string[];
}

/**
 * Interface pour les résultats d'enrichissement
 */
export interface EnrichmentData {
  pathway_id: string;
  pathway_name: string;
  pvalue: number;
  padj: number;
  gene_count: number;
  gene_ratio?: string;
  bg_ratio?: string;
  genes?: string[];
  category?: string;
  regulation?: string;
}

/**
 * Hook pour récupérer les données du volcano plot avec cache
 * Utilise l'endpoint optimisé du backend avec cache multi-niveaux
 * Supporte les seuils dynamiques (padj_threshold, logfc_threshold)
 */
export function useVolcanoPlot(
  datasetId: string,
  comparisonName: string,
  params: VolcanoPlotParams = {},
  enabled: boolean = true
) {
  // Default thresholds
  const padjThreshold = params.padj_threshold ?? 0.05;
  const logfcThreshold = params.logfc_threshold ?? 0.58;
  const maxPoints = params.top_n ?? 5000;

  return useQuery({
    queryKey: ['visualization', 'volcano', datasetId, comparisonName, padjThreshold, logfcThreshold, maxPoints],
    queryFn: async () => {
      // Utilise l'endpoint existant /volcano-plot/ avec thresholds dynamiques
      const response = await api.get(
        `/datasets/${datasetId}/volcano-plot/${encodeURIComponent(comparisonName)}`,
        {
          params: {
            max_points: maxPoints,
            padj_threshold: padjThreshold,
            logfc_threshold: logfcThreshold,
          },
        }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - les calculs sont mis en cache backend par threshold
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && !!comparisonName && enabled,
    // Pas de refetch automatique car données statiques une fois calculées
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook pour récupérer les données de clustering/heatmap
 * Utilise le cache backend avec downsampling intelligent
 * Performance: O(n log n) avec tri simple ou O(n²) avec clustering complet
 */
export function useClustering(
  datasetId: string,
  params: ClusteringParams = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'clustering', datasetId, params],
    queryFn: async () => {
      const response = await api.post<ClusteringResult>(
        `/datasets/${datasetId}/visualizations/clustering`,
        params
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Retry limité car calcul peut être coûteux
    retry: 1,
  });
}

/**
 * Hook pour récupérer les données PCA
 * Cache les résultats car l'analyse PCA est coûteuse
 */
export function usePCAData(
  datasetId: string,
  params: { n_components?: number } = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'pca', datasetId, params],
    queryFn: async () => {
      // Utilise l'endpoint existant /pca qui retourne directement les données
      const response = await api.get(
        `/datasets/${datasetId}/pca`,
        { params }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - calcul coûteux
    gcTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!datasetId && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

/**
 * Hook pour récupérer les données UMAP
 * Cache les résultats car l'analyse UMAP est très coûteuse
 */
export function useUMAPData(
  datasetId: string,
  params: { n_neighbors?: number; min_dist?: number } = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'umap', datasetId, params],
    queryFn: async () => {
      // Utilise l'endpoint existant /umap qui retourne directement les données
      const response = await api.get(
        `/datasets/${datasetId}/umap`,
        { params }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - calcul très coûteux
    gcTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!datasetId && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

/**
 * Hook pour récupérer les données d'enrichissement
 * Support pour multiple catégories (GO, KEGG, Reactome, etc.)
 */
export function useEnrichmentData(
  datasetId: string,
  comparisonName: string,
  params: {
    category?: string;
    pvalue_max?: number;
    min_gene_count?: number;
    regulation?: 'up' | 'down' | 'both';
  } = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'enrichment', datasetId, comparisonName, params],
    queryFn: async () => {
      const response = await api.get<EnrichmentData[]>(
        `/datasets/${datasetId}/enrichment/${comparisonName}`,
        { params }
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
 * Hook pour récupérer les données d'expression de gènes spécifiques
 * Utilisé pour les heatmaps et profils d'expression
 */
export function useGeneExpression(
  datasetId: string,
  geneIds: string[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'gene-expression', datasetId, geneIds],
    queryFn: async () => {
      const response = await api.post(
        `/datasets/${datasetId}/gene-expression`,
        { gene_ids: geneIds }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 20, // 20 minutes
    enabled: !!datasetId && geneIds.length > 0 && enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hooks utilitaires pour précharger les visualisations au survol
 * Améliore l'UX en rendant la navigation instantanée
 */
export function usePrefetchVisualizations() {
  const queryClient = useQueryClient();

  return {
    /**
     * Précharge volcano plot au survol d'une comparaison
     */
    prefetchVolcano: (datasetId: string, comparisonName: string, params: VolcanoPlotParams = {}) => {
      const padjThreshold = params.padj_threshold ?? 0.05;
      const logfcThreshold = params.logfc_threshold ?? 0.58;
      const maxPoints = params.top_n ?? 5000;
      queryClient.prefetchQuery({
        queryKey: ['visualization', 'volcano', datasetId, comparisonName, padjThreshold, logfcThreshold, maxPoints],
        queryFn: async () => {
          const response = await api.get<VolcanoPlotData>(
            `/datasets/${datasetId}/volcano-plot/${encodeURIComponent(comparisonName)}`,
            { params: { max_points: maxPoints, padj_threshold: padjThreshold, logfc_threshold: logfcThreshold } }
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 10,
      });
    },

    /**
     * Précharge données d'enrichissement
     */
    prefetchEnrichment: (datasetId: string, comparisonName: string) => {
      queryClient.prefetchQuery({
        queryKey: ['visualization', 'enrichment', datasetId, comparisonName, {}],
        queryFn: async () => {
          const response = await api.get<EnrichmentData[]>(
            `/datasets/${datasetId}/enrichment/${comparisonName}`
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 10,
      });
    },

    /**
     * Précharge données PCA
     */
    prefetchPCA: (datasetId: string) => {
      queryClient.prefetchQuery({
        queryKey: ['visualization', 'pca', datasetId, {}],
        queryFn: async () => {
          const response = await api.post<PCAData>(
            `/datasets/${datasetId}/visualizations/pca`,
            {}
          );
          return response.data;
        },
        staleTime: 1000 * 60 * 15,
      });
    },
  };
}
