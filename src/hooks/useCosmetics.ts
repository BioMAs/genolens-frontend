/**
 * React Query hooks for the Cosmetics module.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { UserProfile } from '@/types';

export interface CosmeticEvidencePathway {
  term_id: string;
  pathway_name: string;
  direction: string;
  evidence_level: string;
  padj: number;
  category?: string;
  weight: number;
}

export interface CosmeticClaimScore {
  slug: string;
  label: string;
  color: string;
  icon: string;
  skin_zone: string;
  description: string;
  score: number;
  direction: 'favorable' | 'unfavorable';
  n_supporting: number;
  n_contradicting: number;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  evidence_pathways: CosmeticEvidencePathway[];
  top_genes: string[];
}

export interface CosmeticSkinZone {
  slug: string;
  label: string;
  activity: number;
  dominant_direction: 'up' | 'down' | 'neutral';
  n_pathways: number;
}

export interface CosmeticCaveat {
  term_id: string;
  pathway_name: string;
  flag: string;
  note?: string | null;
}

export interface CosmeticReference {
  ref_cat: string;
  source_summary?: string | null;
  url?: string | null;
}

export interface CosmeticsResult {
  dataset_id: string;
  comparison_name: string;
  claims: CosmeticClaimScore[];
  skin_zones: CosmeticSkinZone[];
  caveats: CosmeticCaveat[];
  references: CosmeticReference[];
  coverage: {
    n_significant: number;
    n_matched: number;
    n_terms_matched: number;
    match_rate: number;
  };
}

export interface CosmeticsInterpretation {
  interpretation: string;
  cached: boolean;
  model: string;
  claims_count: number;
  generated_at: string | null;
}

/** Current user profile (includes has_cosmetics_module). */
export function useUserProfile() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get<UserProfile>('/users/me');
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

/** Claim scores for a comparison. Only fetched when `enabled` (module unlocked). */
export function useCosmeticsData(
  datasetId: string | undefined,
  comparisonName: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['cosmetics', datasetId, comparisonName],
    queryFn: async () => {
      const res = await api.get<CosmeticsResult>(
        `/cosmetics/${datasetId}/${encodeURIComponent(comparisonName as string)}`,
      );
      return res.data;
    },
    enabled: enabled && !!datasetId && !!comparisonName,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

/** Generate (or fetch cached) cosmetic AI interpretation. */
export function useCosmeticsInterpretation(
  datasetId: string | undefined,
  comparisonName: string | undefined,
) {
  return useMutation<CosmeticsInterpretation, unknown, boolean>({
    mutationFn: async (forceRegenerate: boolean) => {
      const res = await api.post<CosmeticsInterpretation>(
        `/cosmetics/${datasetId}/${encodeURIComponent(comparisonName as string)}/interpret`,
        null,
        { params: { force_regenerate: forceRegenerate } },
      );
      return res.data;
    },
  });
}
