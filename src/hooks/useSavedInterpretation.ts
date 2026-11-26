'use client';

/**
 * La lecture IA déjà enregistrée d'une comparaison, pour l'afficher sans la produire.
 *
 * **Ne génère jamais.** Chaque génération consomme une requête IA sur un compte plafonné ; elle
 * reste un geste explicite de l'utilisateur, dans `AIInterpretationPanel`. Ici, un GET et rien
 * d'autre.
 *
 * Pas de lecture n'est pas une erreur : un 404, une réponse sans `interpretation` ou vide
 * donnent `text: null`, comme le fait le panneau. Les autres échecs aussi — mais ils ne sont
 * pas mis en cache comme « pas de lecture » : la requête échoue vraiment (React Query retente
 * selon la config), donc un raté réseau n'efface pas pendant des minutes une lecture qui existe.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export interface SavedInterpretation {
  text: string | null;
  isLoading: boolean;
}

/**
 * Clé du cache, exposée pour que celui qui génère une lecture puisse l'invalider ou la poser :
 * sans cela, la page garderait « pas de lecture » jusqu'à l'expiration de l'entrée.
 */
export const savedInterpretationKey = (datasetId: string, comparisonName: string) =>
  ['interpretation', datasetId, comparisonName] as const;

const isNotFound = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { response?: { status?: number } }).response?.status === 404;

export function useSavedInterpretation(
  datasetId: string,
  comparisonName: string,
  enabled: boolean
): SavedInterpretation {
  const { data, isLoading } = useQuery({
    queryKey: savedInterpretationKey(datasetId, comparisonName),
    enabled: enabled && !!datasetId && !!comparisonName,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<string | null> => {
      try {
        const response = await api.get<{ interpretation?: string | null }>(
          `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/interpretation`
        );
        const text = response.data?.interpretation;
        return typeof text === 'string' && text.length > 0 ? text : null;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
  });

  return { text: data ?? null, isLoading };
}
