'use client';

/**
 * Les verrous de la page de lecture, regroupés.
 *
 * Chaque réponse de la page se débloque derrière un module ; la page pose une question ici
 * plutôt que d'en assembler cinq. Le hook ne décide de rien : il lit les drapeaux que
 * `/users/me` sert déjà (le profil vient de `useUserProfile`, l'unique lecteur de cette route)
 * et applique le contournement par rôle d'`isPrivilegedRole`.
 *
 * - `skin`    : module Cosmétique (`has_cosmetics_module`)
 * - `targets` : module Drug Discovery (`has_drug_discovery_module`)
 * - `science` : outils scientifiques — GSEA, signature, nuage de contrastes
 *               (`has_scientific_module`)
 * - `report`  : personnalisation du rapport (`has_report_customization`)
 * - `ai`      : lecture IA, selon le plan ET les requêtes accordées (`canUseAI`)
 *
 * Tant que le profil n'est pas arrivé, tout est `false` et `loaded` aussi : la page peut ainsi
 * ne pas afficher un verrou à quelqu'un qui a le module (même convention que `useAddOnModules`).
 */

import { useMemo } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseAI, isPrivilegedRole } from '@/utils/plan';

export interface ModuleAccess {
  skin: boolean;
  targets: boolean;
  science: boolean;
  report: boolean;
  ai: boolean;
  /** Le profil est arrivé — avant, ne pas montrer d'état verrouillé. */
  loaded: boolean;
}

const NOT_LOADED: ModuleAccess = {
  skin: false,
  targets: false,
  science: false,
  report: false,
  ai: false,
  loaded: false,
};

export function useModuleAccess(): ModuleAccess {
  const { data: profile } = useUserProfile();

  return useMemo(() => {
    if (!profile) return NOT_LOADED;

    const privileged = isPrivilegedRole(profile.role);
    return {
      skin: privileged || profile.has_cosmetics_module === true,
      targets: privileged || profile.has_drug_discovery_module === true,
      science: privileged || profile.has_scientific_module === true,
      report: privileged || profile.has_report_customization === true,
      ai: canUseAI(profile),
      loaded: true,
    };
  }, [profile]);
}
