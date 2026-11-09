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

function interpretationKey(datasetId: string | undefined, comparisonName: string | undefined, alpha: number) {
  return ['cosmomics-nova-interpretation', datasetId, comparisonName, alpha] as const;
}

function statusOf(err: unknown): unknown {
  return (err as { response?: { status?: unknown } } | null)?.response?.status;
}

/**
 * The AI reading already saved for this comparison, or `null` when there is none (the
 * route answers 404). A read: it never calls the model and spends no AI request. `alpha` is
 * the nova's own — the route says the text is `stale` when it was written for another one.
 * Needs AI access like the route does: pass `enabled` false without it.
 */
export function useCosmOmicsSavedInterpretation(
  datasetId: string | undefined,
  comparisonName: string | undefined,
  alpha: number,
  enabled: boolean,
) {
  return useQuery<CosmOmicsInterpretation | null>({
    queryKey: interpretationKey(datasetId, comparisonName, alpha),
    queryFn: async () => {
      try {
        const res = await api.get<CosmOmicsInterpretation>(
          `${novaPath(datasetId as string, comparisonName as string)}/interpretation`,
          { params: { alpha } },
        );
        return res.data;
      } catch (err) {
        if (statusOf(err) === 404) return null;
        throw err;
      }
    },
    enabled: enabled && !!datasetId && !!comparisonName,
    staleTime: 1000 * 60,
    retry: false,
  });
}

/**
 * Generate (or fetch the cached) cosmetic AI reading of the nova. The caller asks the user
 * first: this is the call that sends the nova's names and p-values to the model.
 */
export function useCosmOmicsInterpretation(
  datasetId: string | undefined,
  comparisonName: string | undefined,
  alpha = 0.05,
) {
  const queryClient = useQueryClient();
  return useMutation<CosmOmicsInterpretation, unknown, boolean>({
    mutationFn: async (forceRegenerate: boolean) => {
      const res = await api.post<CosmOmicsInterpretation>(
        `${novaPath(datasetId as string, comparisonName as string)}/interpret`,
        null,
        { params: { force_regenerate: forceRegenerate, alpha } },
      );
      return res.data;
    },
    onSuccess: (reading) => {
      // The text just written is now the saved one: the panel reads it from there.
      queryClient.setQueryData(interpretationKey(datasetId, comparisonName, alpha), reading);
      // A generated interpretation consumed one AI request on a capped account.
      invalidateUserProfile(queryClient);
    },
  });
}
