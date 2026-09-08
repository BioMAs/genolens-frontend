/**
 * Seule autorité du frontend sur « ce qu'il me reste ».
 *
 * Avant ce hook, chaque surface portait sa propre règle : le calcul des
 * crédits IA vivait dans `QuotaDisplay` avec son quota gratuit de 15 codé en
 * dur, la limite de projets était lue sur `GET /billing/subscription` — qui ne
 * la renvoie pas, d'où une jauge bloquée à 0 — et huit lecteurs appelaient
 * `/users/me` sous quatre identités de cache.
 *
 * Toutes les données viennent de `/users/me` (schéma `UserSelf` côté backend),
 * `project_count` inclus. Surtout PAS du total de la liste de projets :
 * `GET /projects` renvoie les projets possédés *ou partagés*, donc son total
 * compterait les projets d'autrui contre le quota de l'utilisateur, alors que
 * `project_count` applique le même prédicat que la limite du backend.
 *
 * Ce hook compose `useUserProfile` plutôt que de refaire sa requête : même
 * clé, même `staleTime`, donc React Query dédoublonne et deux lecteurs ne font
 * qu'un appel. Attention : `useCosmetics.ts` exporte un SECOND
 * `useUserProfile` sur la clé `['user','me']` ; importer celui-là ajouterait
 * une requête sans provoquer la moindre erreur de type.
 */
import { useUserProfile } from '@/hooks/useUserProfile';
import { hasUnlimitedAI, isPrivilegedRole } from '@/utils/plan';

export type QuotaTone = 'ok' | 'low' | 'exhausted';

export interface QuotaSlice {
  used: number;
  /** `null` = illimité. */
  max: number | null;
  /** `null` = illimité. */
  remaining: number | null;
  unlimited: boolean;
}

export interface QuotaState {
  comparisons: QuotaSlice;
  projects: QuotaSlice;
  ai: { credits: number | null; unlimited: boolean };
  maxDatasetsPerProject: number | null;
  resetsOn: Date;
  /** Ton des comparaisons : le quota mis en avant sur le dashboard. */
  tone: QuotaTone;
  isLoading: boolean;
  /** Faux tant que le profil n'est pas arrivé, erreur comprise. */
  hasProfile: boolean;
  isError: boolean;
}

/**
 * Interprétations IA offertes hors abonnement payant.
 *
 * Valeur reprise telle quelle de `QuotaDisplay`, où elle était en dur. Elle
 * n'est pas servie par l'API : la déplacer ici ne la rend pas plus vraie, mais
 * il n'y a plus qu'un seul endroit à corriger quand le backend l'exposera.
 */
const FREE_AI_ALLOWANCE = 15;

/** En dessous de ce reste, on prévient. */
const LOW_RATIO = 0.2;

/**
 * Ton d'un quota, d'après ce qu'il reste rapporté au plafond.
 *
 * Un quota illimité (`max` ou `remaining` à `null`) est toujours `ok` : sans
 * ce cas, un compte admin verrait le rouge de l'épuisement.
 */
export function quotaTone(remaining: number | null, max: number | null): QuotaTone {
  if (max === null || remaining === null) return 'ok';
  if (remaining <= 0) return 'exhausted';
  if (max > 0 && remaining / max <= LOW_RATIO) return 'low';
  return 'ok';
}

/**
 * Prochaine remise à zéro du compteur mensuel.
 *
 * Le worker le remet à zéro le 1er du mois
 * (`app/worker/tasks/quota_tasks.py`) ; rien n'est exposé par l'API pour ça,
 * donc la date est calculée ici.
 */
export function nextMonthlyReset(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/**
 * Plafond servi par l'API, en distinguant les deux sens de l'absence.
 *
 * `null` veut dire « illimité » — le backend l'écrit explicitement. `undefined`
 * veut dire « le champ n'est pas là », ce qui n'autorise rien : c'est en
 * lisant un champ manquant comme un illimité qu'un plan plafonné a pu
 * afficher ∞. On échoue donc fermé, sur 0.
 */
function readCap(value: number | null | undefined, unlimited: boolean): number | null {
  if (unlimited) return null;
  if (value === null) return null;
  return value ?? 0;
}

export function useQuotas(): QuotaState {
  const { data: profile, isLoading, isError } = useUserProfile();

  const privileged = isPrivilegedRole(profile?.role);

  const comparisonsUsed = profile?.comparisons_used_this_month ?? 0;
  const comparisonsMax = readCap(profile?.comparisons_quota, privileged);
  const comparisonsRemaining =
    comparisonsMax === null
      ? null
      : (profile?.comparisons_remaining ?? Math.max(0, comparisonsMax - comparisonsUsed));

  const projectsUsed = profile?.project_count ?? 0;
  const projectsMax = readCap(profile?.max_projects, privileged);
  const projectsRemaining = projectsMax === null ? null : Math.max(0, projectsMax - projectsUsed);

  const aiUnlimited = hasUnlimitedAI(profile ?? null);
  const paidRemaining = (profile?.ai_tokens_purchased ?? 0) - (profile?.ai_tokens_used ?? 0);
  const freeRemaining = Math.max(0, FREE_AI_ALLOWANCE - (profile?.ai_interpretations_used ?? 0));

  const hasProfile = !!profile;

  return {
    comparisons: {
      used: comparisonsUsed,
      max: comparisonsMax,
      remaining: comparisonsRemaining,
      unlimited: comparisonsMax === null,
    },
    projects: {
      used: projectsUsed,
      max: projectsMax,
      remaining: projectsRemaining,
      unlimited: projectsMax === null,
    },
    ai: {
      // Le solde payé peut être négatif (jetons consommés au-delà de l'achat) ;
      // il compense alors le gratuit, mais le total affiché ne descend pas
      // sous zéro. Report exact du calcul de QuotaDisplay.
      credits: aiUnlimited ? null : Math.max(0, paidRemaining + freeRemaining),
      unlimited: aiUnlimited,
    },
    maxDatasetsPerProject: profile?.max_datasets_per_project ?? null,
    resetsOn: nextMonthlyReset(),
    // Pendant le chargement on reste neutre : le ton dérivé d'un profil absent
    // vaudrait « exhausted » (max 0, reste 0), donc un placeholder rouge et un
    // CTA « Upgrade » à chaque chargement du dashboard.
    tone: hasProfile ? quotaTone(comparisonsRemaining, comparisonsMax) : 'ok',
    isLoading,
    hasProfile,
    isError,
  };
}

export interface ProjectLimit {
  /** Vrai seulement quand on SAIT que le plafond est atteint. */
  blocked: boolean;
  /** Libellé prêt à afficher, absent quand rien ne bloque. */
  reason?: string;
}

/**
 * Barrière de création de projet, partagée par le dashboard et /projects.
 *
 * Elle était écrite deux fois, mot pour mot, et les deux copies lisaient
 * `subscription.max_projects` — un champ que `/billing/subscription` ne renvoie
 * pas. La comparaison portait donc toujours sur `undefined`, et personne
 * n'était jamais bloqué : la barrière existait sans agir.
 *
 * Elle échoue OUVERT, délibérément, dans les deux cas d'incertitude : profil en
 * vol et profil jamais arrivé. Bloquer par défaut empêcherait une création
 * légitime, alors que le backend refuse de toute façon au-delà du plafond.
 * Sans cette garde, un profil indéfini donne 0 >= 0 et désactive le bouton
 * avec « Project limit reached (0/0) » à chaque chargement.
 */
export function useProjectLimit(): ProjectLimit {
  const { projects, isLoading, hasProfile } = useQuotas();

  // `max === 0` n'est pas un plafond de zero projet : aucun plan n'en vend, et
  // c'est la valeur que `readCap` produit quand le champ est ABSENT de la
  // charge utile. Le traiter comme un plafond reel bloquerait la creation avec
  // « (4/0) » sur une donnee manquante — la troisieme incertitude, a traiter
  // comme les deux autres.
  if (isLoading || !hasProfile || projects.unlimited || !projects.max) {
    return { blocked: false };
  }
  if (projects.used < projects.max) {
    return { blocked: false };
  }
  return {
    blocked: true,
    reason: `Project limit reached (${projects.used}/${projects.max}). Upgrade your plan.`,
  };
}
