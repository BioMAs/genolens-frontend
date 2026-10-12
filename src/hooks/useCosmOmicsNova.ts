/**
 * React Query hooks for the CosmOmics module (Skin claims add-on).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { invalidateUserProfile } from '@/hooks/useUserProfile';
import type { CosmOmicsInterpretation, CosmOmicsNovaData } from '@/types/cosmomics';

function novaPath(datasetId: string, comparisonName: string) {
  return `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/cosmomics-nova`;
}

/** Pathway nova of a comparison. Only fetched when `enabled` (add-on unlocked). */
export function useCosmOmicsNova(
  datasetId: string | undefined,
  comparisonName: string | undefined,
  enabled: boolean,
  alpha = 0.05,
) {
  return useQuery({
    queryKey: ['cosmomics-nova', datasetId, comparisonName, alpha],
    queryFn: async () => {
      const res = await api.get<CosmOmicsNovaData>(novaPath(datasetId as string, comparisonName as string), {
        params: { alpha },
      });
      return res.data;
    },
    enabled: enabled && !!datasetId && !!comparisonName,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

/** Generate (or fetch the cached) cosmetic AI reading of the nova. */
export function useCosmOmicsInterpretation(datasetId: string | undefined, comparisonName: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<CosmOmicsInterpretation, unknown, boolean>({
    mutationFn: async (forceRegenerate: boolean) => {
      const res = await api.post<CosmOmicsInterpretation>(
        `${novaPath(datasetId as string, comparisonName as string)}/interpret`,
        null,
        { params: { force_regenerate: forceRegenerate } },
      );
      return res.data;
    },
    // A generated interpretation consumed one AI request on a capped account.
    onSuccess: () => invalidateUserProfile(queryClient),
  });
}
