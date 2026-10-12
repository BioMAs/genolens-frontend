/**
 * Profil de l'utilisateur courant, plan et rôle compris.
 *
 * SEUL lecteur de `/users/me`, sur la clé `['userProfile']` : tout composant
 * qui a besoin du profil passe par ce hook, et React Query ne fait qu'un appel
 * quel que soit le nombre de lecteurs sur la page. Le 12/10/2026, la page de
 * comparaison l'appelait encore cinq fois au montage — un `useEffect` par
 * panneau IA et un second `useUserProfile` dans `useCosmetics.ts`, sur la clé
 * `['user','me']`. Ne pas en recréer un : un lecteur sur une autre clé coûte
 * une requête de plus sans la moindre erreur de type.
 *
 * `enabled: false` pour une page publique qui ne doit interroger `/users/me`
 * qu'une fois la session confirmée (la page pricing : un visiteur anonyme
 * recevrait un 401).
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';

import api from '@/utils/api';
import { UserProfile } from '@/types';

export function useUserProfile(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await api.get<UserProfile>('/users/me')).data,
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: options.enabled ?? true,
  });
}

/**
 * Fait relire `/users/me` après une action qui change ses compteurs — chaque
 * appel réel au LLM consomme une requête IA sur un compte plafonné.
 */
export function invalidateUserProfile(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['userProfile'] });
}
