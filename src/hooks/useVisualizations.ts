import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { DEFAULT_THRESHOLDS, type VolcanoPoint } from '@/utils/volcano';

export type { VolcanoPoint };

/**
 * Réponse réelle de `GET /datasets/{id}/volcano-plot/{comparison}`.
 *
 * L'interface précédente déclarait des tableaux parallèles (`genes`, `log2FoldChange`, `padj`,
 * `significant`) que le backend n'a jamais renvoyés : `VolcanoPlot` lisait déjà `data.points` en
 * contournant le type par une assertion. Corrigé ici d'après `datasets.py:2036-2050` (chemin en
 * cache) et `:2143-2162` (chemin Parquet à froid).
 *
 * Attention à `total_genes` : les deux chemins serveur ne lui donnent pas le même sens —
 * `len(points)`, donc les points renvoyés, sur le chemin en cache (`:2039`), contre
 * `len(df_valid)`, donc les gènes réellement testés, sur le chemin à froid (`:2159`). Ne pas
 * l'afficher comme « gènes testés » ; passer par `deriveSignificance` pour tout décompte.
 */
export interface VolcanoPlotData {
  dataset_id: string;
  comparison_name: string;
  points: VolcanoPoint[];
  /** Sens divergent selon le chemin serveur — voir ci-dessus. */
  total_genes: number;
  /** Décompte du serveur aux seuils qu'il a reçus ; recalculé côté client. */
  significant_genes: number;
  downsampled?: boolean;
  cached?: boolean;
  thresholds?: { padj: number; logfc: number };
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

/** Nombre de points demandés au serveur. Le nuage entier tient sous ce plafond. */
export const VOLCANO_MAX_POINTS = 5000;

/**
 * Nuage du volcano, récupéré **une seule fois**, indépendamment des seuils.
 *
 * L'endpoint ne filtre pas par seuil : sur le chemin en cache il renvoie tout le nuage et ne
 * recalcule que `is_significant` (`datasets.py:2014-2044`), et sur le chemin à froid il garde
 * toujours tous les points significatifs (`:2124-2136`). Les seuils sont donc **absents de la clé
 * React Query** : changer un seuil ne déclenche aucune requête, la significativité est dérivée
 * côté client par `deriveSignificance`.
 *
 * Sain sur les deux chemins uniquement parce que les seuils ne peuvent que resserrer : la requête
 * part aux seuils d'ingestion, et resserrer ne fait que réduire un ensemble déjà présent dans le
 * nuage. Voir `src/utils/volcano.ts`.
 *
 * `useVolcanoPlot` reste en place pour les appelants qui laissent encore le serveur trancher.
 */
export function useVolcanoPoints(
  datasetId: string,
  comparisonName: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['visualization', 'volcano-cloud', datasetId, comparisonName, VOLCANO_MAX_POINTS],
    queryFn: async () => {
      const response = await api.get<VolcanoPlotData>(
        `/datasets/${datasetId}/volcano-plot/${encodeURIComponent(comparisonName)}`,
        {
          params: {
            max_points: VOLCANO_MAX_POINTS,
            padj_threshold: DEFAULT_THRESHOLDS.padj,
            logfc_threshold: DEFAULT_THRESHOLDS.logfc,
          },
        }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    enabled: !!datasetId && !!comparisonName && enabled,
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
        `/enrichment/${datasetId}/${comparisonName}`,
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
     * Précharge le nuage du volcano au survol d'une comparaison.
     *
     * La clé doit être **exactement** celle de `useVolcanoPoints`, sinon le survol chaufferait
     * une entrée de cache que personne ne lit — le préchargement cesserait de servir en silence.
     */
    prefetchVolcano: (datasetId: string, comparisonName: string) => {
      queryClient.prefetchQuery({
        queryKey: ['visualization', 'volcano-cloud', datasetId, comparisonName, VOLCANO_MAX_POINTS],
        queryFn: async () => {
          const response = await api.get<VolcanoPlotData>(
            `/datasets/${datasetId}/volcano-plot/${encodeURIComponent(comparisonName)}`,
            {
              params: {
                max_points: VOLCANO_MAX_POINTS,
                padj_threshold: DEFAULT_THRESHOLDS.padj,
                logfc_threshold: DEFAULT_THRESHOLDS.logfc,
              },
            }
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
            `/enrichment/${datasetId}/${comparisonName}`
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
