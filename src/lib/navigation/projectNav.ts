/**
 * La navigation d'un projet — ce que la sidebar portait sous « Project ».
 *
 * Cinq sections (Overview, Setup, Analyses, Multi-comparison, Contrast scatter),
 * dont deux peuvent etre verrouillees. Les libelles et les raisons de verrou sont
 * ceux de la sidebar, repris a l'identique : c'est un deplacement, pas une
 * reecriture.
 *
 * Ce module porte aussi DEUX regles de route, parce qu'elles ne sont pas
 * interchangeables :
 *
 *   - `isProjectLevelRoute` : la rangee d'onglets est-elle rendue ici ? Oui sur le
 *     projet et ses cinq sections ; non sur ce qu'on ouvre DEPUIS le projet — une
 *     analyse, une comparaison, un dataset —, ou c'est le fil d'Ariane qui ramene
 *     en arriere.
 *   - `resolveActiveProjectTab` : quelle section est « la courante » ? Plus large :
 *     une analyse reste dans Analyses (la sidebar l'allumait deja), meme si la
 *     rangee n'est pas rendue sur sa page.
 *
 * Les deux lisent le chemin SEGMENT PAR SEGMENT, jamais par `startsWith` :
 * `/projects/p1/multi-comparisons` n'est pas une section.
 */
import { PLAN_GATE_COPY } from '@/utils/plan';

export type ProjectNavKey = 'overview' | 'setup' | 'analyses' | 'multi' | 'scatter';

export interface ProjectNavItem {
  key: ProjectNavKey;
  label: string;
  href: string;
  /** Pourquoi la section est verrouillee, ou `null` si elle est ouverte. */
  lockedReason: string | null;
}

export interface ProjectNavGates {
  /** Droit du plan `multi_comparison` (Pro et au-dessus). */
  canMulti: boolean;
  /** Module « Scientific tools », que l'admin active par utilisateur. */
  canScatter: boolean;
}

/** Raison de verrou du nuage de contrastes : une option, pas un plan. */
const SCIENCE_LOCK_REASON = 'Scientific tools add-on — ask an admin to enable it';

/**
 * Dans l'ordre d'affichage. `suffix` se colle apres `/projects/<id>`.
 * Les cles de route (`multi-comparison`) et les cles de section (`multi`) different
 * volontairement : la seconde est un identifiant court, la premiere une URL.
 */
const SECTIONS: ReadonlyArray<{ key: ProjectNavKey; suffix: string; label: string }> = [
  { key: 'overview', suffix: '', label: 'Overview' },
  { key: 'setup', suffix: '/setup', label: 'Setup' },
  { key: 'analyses', suffix: '/analyses', label: 'Analyses' },
  { key: 'multi', suffix: '/multi-comparison', label: 'Multi-comparison' },
  { key: 'scatter', suffix: '/contrast-scatter', label: 'Contrast scatter' },
];

export function buildProjectNav(projectId: string, gates: ProjectNavGates): ProjectNavItem[] {
  return SECTIONS.map(({ key, suffix, label }) => {
    // Deux raisons independantes de verrou : un droit de plan, une option activee
    // par l'admin. Elles ne se confondent pas, et l'infobulle doit dire laquelle.
    let lockedReason: string | null = null;
    if (key === 'multi' && !gates.canMulti) lockedReason = PLAN_GATE_COPY.multiComparison;
    if (key === 'scatter' && !gates.canScatter) lockedReason = SCIENCE_LOCK_REASON;
    return { key, label, href: `/projects/${projectId}${suffix}`, lockedReason };
  });
}

/** Segments apres `/projects/<id>`, sans le segment vide d'un `/` final. */
function segmentsBelowProject(pathname: string): string[] | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'projects' || parts.length < 2) return null;
  return parts.slice(2);
}

/**
 * La rangee d'onglets est-elle rendue sur cette route ?
 *
 * Vrai pour `/projects/<id>` et pour `/setup`, `/analyses`, `/analyses/new`,
 * `/multi-comparison`, `/contrast-scatter`. Faux pour tout le reste : une analyse
 * (`/analyses/<id>`), une comparaison, un dataset.
 */
export function isProjectLevelRoute(pathname: string): boolean {
  const below = segmentsBelowProject(pathname);
  if (below === null) return false;
  const [first, second, ...rest] = below;
  if (first === undefined) return true;
  if (rest.length > 0) return false;
  if (first === 'analyses') return second === undefined || second === 'new';
  if (second !== undefined) return false;
  return first === 'setup' || first === 'multi-comparison' || first === 'contrast-scatter';
}

/**
 * La section courante, ou `null` quand la route n'appartient a aucune.
 *
 * Plus large que `isProjectLevelRoute` : tout ce qui est sous `/analyses` (une
 * analyse, ses comparaisons) reste dans Analyses. Une comparaison atteinte
 * directement (`/comparisons/…`) et un dataset n'ont pas de section.
 */
export function resolveActiveProjectTab(pathname: string): ProjectNavKey | null {
  const below = segmentsBelowProject(pathname);
  if (below === null) return null;
  const [first] = below;
  if (first === undefined) return 'overview';
  if (first === 'setup') return 'setup';
  if (first === 'analyses') return 'analyses';
  if (first === 'multi-comparison') return 'multi';
  if (first === 'contrast-scatter') return 'scatter';
  return null;
}
