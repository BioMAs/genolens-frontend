/**
 * Profil de l'utilisateur courant, plan et rôle compris.
 *
 * Lecteur canonique de `/users/me`, sur la clé `['userProfile']`. `useQuotas`
 * le compose plutôt que de refaire la requête.
 *
 * Six lecteurs l'appellent encore à la main, hors périmètre du lot quotas :
 * `useCosmetics.ts` (qui exporte un SECOND `useUserProfile`, sur la clé
 * `['user','me']`, importé par `useAddOnModules`), `app/profile/MyModules.tsx`,
 * `app/pricing/page.tsx`, `AIChartAssistant.tsx`, `EnrichmentRadarPlot.tsx` et
 * `AIInterpretationPanel.tsx`. Le dashboard et `QuotaDisplay` ont migré ici.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';

import api from '@/utils/api';
import { UserProfile } from '@/types';

export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await api.get<UserProfile>('/users/me')).data,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/**
 * Fait relire `/users/me` après une action qui change ses compteurs — chaque
 * appel réel au LLM consomme une requête IA sur un compte plafonné.
 *
 * Les DEUX clés sont invalidées : ce hook (`['userProfile']`) et le second
 * `useUserProfile` de `useCosmetics.ts` (`['user','me']`). N'en invalider
 * qu'une laisserait l'autre lecteur afficher l'ancien compteur.
 */
export function invalidateUserProfile(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  void queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
}
