'use client';

import { useUserProfile } from '@/hooks/useCosmetics';
import type { UserProfile } from '@/types';

interface AddOnAccess {
  /** The module is available to this user. */
  unlocked: boolean;
  /** The profile has arrived — until then, don't flash a locked state. */
  loaded: boolean;
}

/**
 * Access to a per-user add-on module. Admins always have every module by role;
 * everyone else needs the explicit flag an admin unlocks. Independent of the
 * subscription plan.
 */
function useAddOn(flag: keyof UserProfile): AddOnAccess {
  const { data: profile } = useUserProfile();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SCILICIUM_ADMIN';
  return {
    loaded: !!profile,
    unlocked: !!profile && (isAdmin || profile[flag] === true),
  };
}

/**
 * Scientific tools add-on: GSEA, contrast scatter, per-sample signature
 * scoring, custom gene sets, DEG patterns.
 */
export function useScientificModule(): AddOnAccess {
  return useAddOn('has_scientific_module');
}

/**
 * Drug Discovery add-on: target ranking across indications, and confronting a
 * comparison's DEGs with those rankings. Gated per-user rather than by plan.
 */
export function useDrugDiscoveryModule(): AddOnAccess {
  return useAddOn('has_drug_discovery_module');
}
