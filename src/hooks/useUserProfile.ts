/**
 * Profil de l'utilisateur courant, plan et rôle compris.
 *
 * Quatre composants appellent `/users/me` à la main aujourd'hui. Ce hook ne les migre pas —
 * il évite d'en ajouter un cinquième.
 */
import { useQuery } from '@tanstack/react-query';

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
