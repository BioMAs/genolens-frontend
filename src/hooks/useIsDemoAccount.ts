/**
 * Vrai quand l'utilisateur courant est un compte de démonstration.
 *
 * Compose `useUserProfile` (clé `['userProfile']`) plutôt que de refaire la
 * requête. Vaut `false` tant que le profil n'est pas arrivé, erreur comprise,
 * et quand le champ `is_demo` est absent (backend antérieur à la fonction) :
 * le drapeau n'ajoute que des marques (filigrane, bandeau), il ne doit jamais
 * en poser une sur un compte qui n'en est pas un.
 */
import { useUserProfile } from '@/hooks/useUserProfile';

export function useIsDemoAccount(): boolean {
  const { data: profile } = useUserProfile();
  return profile?.is_demo === true;
}
