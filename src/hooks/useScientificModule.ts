'use client';

import { useUserProfile } from '@/hooks/useCosmetics';

/**
 * Access to the Scientific tools add-on module (GSEA, contrast scatter,
 * per-sample signature scoring, custom gene sets, DEG patterns).
 *
 * Admins always have it by role; everyone else needs the per-user flag an admin
 * unlocks. `loaded` tells callers the profile has arrived, so a locked surface
 * isn't flashed before the answer is known.
 */
export function useScientificModule(): { unlocked: boolean; loaded: boolean } {
  const { data: profile } = useUserProfile();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SCILICIUM_ADMIN';
  return {
    loaded: !!profile,
    unlocked: !!profile && (isAdmin || profile.has_scientific_module === true),
  };
}
