/**
 * Le catalogue de la palette de commandes.
 *
 * Module PUR, sans React : la construction de la liste et son filtrage sont les
 * deux endroits ou une palette se trompe — un element absent, un element
 * propose hors contexte, un classement qui enterre ce qu'on cherche. Isoles
 * ici, ils se testent ; noyes dans le composant, ils ne se verifient qu'a la
 * main, une fois sur deux.
 */

import { PARAM_GENE } from '@/components/comparison/explorerUrl';
import { comparisonTitle } from '@/components/dashboard/format';
import { comparisonHref } from '@/lib/navigation/comparisonHref';
import { DESTINATIONS, type DestinationKey } from '@/lib/navigation/destinations';
import type { UserComparisonItem } from '@/hooks/useAllComparisons';
import type { GeneSearchResult } from '@/types/gene-search';

export type CommandKind = 'navigate' | 'project' | 'comparison' | 'gene' | 'action';

/** Sens de variation d'un gene dans une comparaison, tel que l'ingestion l'a classe. */
export type GeneDirection = 'up' | 'down' | 'ns';

export interface Command {
  id: string;
  label: string;
  /** Precision affichee en gris a droite du libelle. */
  hint?: string;
  kind: CommandKind;
  /** Mots supplementaires pris en compte par la recherche, jamais affiches. */
  keywords?: string[];
  href?: string;
  run?: () => void;
  /** Genes seulement : le sens de variation, affiche en tete de la precision. */
  direction?: GeneDirection;
}

export interface CommandGroup {
  heading: string;
  items: Command[];
}

/**
 * Mots-cles des destinations de la barre du haut. Le libelle et l'adresse ne
 * sont PAS repetes ici : ils viennent de `DESTINATIONS`, parce qu'une route
 * retiree de la navigation doit disparaitre d'ici du meme coup. Le `Record`
 * force a en ecrire pour toute destination ajoutee.
 */
const DESTINATION_KEYWORDS: Record<DestinationKey, string[]> = {
  home: ['dashboard', 'accueil', 'start'],
  projects: ['projets', 'datasets', 'studies'],
  tools: ['ontology', 'power analysis', 'outils'],
};

/**
 * « Go to » : les trois destinations de la barre du haut, puis le profil, qui
 * vit dans le menu du compte. Ni la liste globale des comparaisons (ses lignes
 * sont des resultats de recherche, voir `comparisonCommands`) ni la
 * documentation (menu d'aide) : les proposer ici les ferait reapparaitre par
 * la fenetre apres que la navigation les a retirees.
 */
const ROUTES: Array<{ href: string; label: string; keywords: string[] }> = [
  ...DESTINATIONS.map((d) => ({
    href: d.href,
    label: d.label,
    keywords: DESTINATION_KEYWORDS[d.key],
  })),
  { href: '/profile', label: 'Profile & plan', keywords: ['account', 'billing', 'compte', 'quota'] },
];

export interface CommandActions {
  toggleTheme: () => void;
  theme: 'light' | 'dark';
  toggleColorblind: () => void;
  colorblind: boolean;
  restartTour?: () => void;
}

export interface ProjectLike {
  id: string;
  name: string;
}

export function buildCommands(opts: {
  projects: ProjectLike[];
  /** Deja classees et plafonnees : voir `comparisonCommands`. */
  comparisons?: Command[];
  actions: CommandActions;
}): CommandGroup[] {
  const { projects, comparisons = [], actions } = opts;

  const groups: CommandGroup[] = [
    {
      heading: 'Go to',
      items: ROUTES.map((r) => ({
        id: `route:${r.href}`,
        label: r.label,
        kind: 'navigate' as const,
        href: r.href,
        keywords: r.keywords,
      })),
    },
  ];

  if (projects.length) {
    groups.push({
      heading: 'Projects',
      items: projects.map((p) => ({
        id: `project:${p.id}`,
        label: p.name,
        kind: 'project' as const,
        href: `/projects/${p.id}`,
        // Le nom du projet suffit a le trouver ; `project` permet de lister
        // tous les projets sans en connaitre un seul.
        keywords: ['project', 'projet'],
      })),
    });
  }

  if (comparisons.length) {
    groups.push({ heading: 'Comparisons', items: comparisons });
  }

  const actionItems: Command[] = [
    {
      id: 'action:theme',
      label: actions.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      kind: 'action',
      keywords: ['theme', 'dark', 'light', 'sombre', 'clair', 'appearance'],
      run: actions.toggleTheme,
    },
    {
      id: 'action:colorblind',
      label: actions.colorblind
        ? 'Use the standard chart palette'
        : 'Use the colorblind-safe chart palette',
      kind: 'action',
      keywords: ['colorblind', 'daltonisme', 'palette', 'accessibility', 'wong'],
      run: actions.toggleColorblind,
    },
  ];
  if (actions.restartTour) {
    actionItems.push({
      id: 'action:tour',
      label: 'Replay the guided tour of this screen',
      kind: 'action',
      keywords: ['tour', 'guide', 'onboarding', 'visite', 'help'],
      run: actions.restartTour,
    });
  }
  groups.push({ heading: 'Actions', items: actionItems });

  return groups;
}

/**
 * Score d'une commande pour une requete.
 *
 * Trois paliers, et l'ordre compte plus que la finesse : un prefixe bat une
 * sous-chaine, qui bat un mot-cle. Sans cela « pro » proposerait « Profile »
 * avant « Projects » une fois sur deux, selon l'ordre de declaration — et une
 * palette dont le premier resultat change d'un jour a l'autre ne s'apprend pas.
 *
 * `null` signifie « ne correspond pas », et non « score nul » : les deux se
 * confondraient a la comparaison.
 */
export function scoreCommand(command: Command, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = command.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  if (command.keywords?.some((k) => k.toLowerCase().includes(q))) return 1;
  return null;
}

/**
 * Filtre et ordonne UNE liste : le classement des projets, des comparaisons et
 * de chaque groupe passe par la, pour qu'il n'y en ait qu'un.
 */
function rankCommands(items: Command[], query: string): Command[] {
  return items
    .map((item) => ({ item, score: scoreCommand(item, query) }))
    .filter((s): s is { item: Command; score: number } => s.score !== null)
    // Tri STABLE sur le score seul : a score egal, l'ordre de declaration
    // est conserve, et c'est lui qui porte la hierarchie du produit.
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}

/** Filtre et ordonne, en preservant les groupes et en jetant ceux qui se vident. */
export function filterCommands(groups: CommandGroup[], query: string): CommandGroup[] {
  if (!query.trim()) return groups;
  return groups
    .map((group) => ({ heading: group.heading, items: rankCommands(group.items, query) }))
    .filter((group) => group.items.length > 0);
}

/** La liste a plat, dans l'ordre d'affichage — c'est elle que le clavier parcourt. */
export function flattenCommands(groups: CommandGroup[]): Command[] {
  return groups.flatMap((g) => g.items);
}

/**
 * Ce que la palette sait d'une comparaison. `ComparisonSummary` ne suffit pas :
 * il ne porte ni le projet ni son nom, donc ni l'adresse ni la precision. C'est
 * la ligne de la liste transversale (`UserComparisonItem`) qu'il faut.
 */
export type ComparisonLike = Pick<
  UserComparisonItem,
  'name' | 'project_id' | 'project_name' | 'dataset_id'
>;

/** Autant de lignes que la palette en montre sans defiler, comme pour les genes. */
export const COMPARISON_RESULT_LIMIT = 6;

/**
 * La liste complete des comparaisons, en fin de groupe. La palette ne cherche
 * que dans les 100 plus recentes (le maximum d'une page) : au-dela, c'est cette
 * liste qui retrouve une comparaison, et elle a quitte la barre du haut.
 */
const ALL_COMPARISONS: Command = {
  id: 'route:/comparisons',
  label: 'All comparisons',
  kind: 'navigate',
  href: '/comparisons',
  keywords: ['comparisons', 'comparaisons', 'deg', 'contrasts', 'results'],
};

/**
 * Les comparaisons que la palette propose pour une requete : six au plus, classees
 * comme les projets (prefixe, puis sous-chaine, puis mot-cle ; a egalite, l'ordre
 * recu — la plus recente d'abord).
 *
 * Le libelle est le NOM, tel que le backend le donne, comme sur les lignes de
 * gene (« TP53 · Drug_vs_Vehicle · Liver ») : la meme comparaison ne s'ecrit pas
 * de deux facons dans la meme liste. La forme lisible du tableau de bord
 * (« Drug vs Vehicle ») et le nom du projet restent des mots-cles, donc
 * trouvables sans etre affiches. Le projet va aussi en precision : deux projets
 * ont souvent une comparaison du meme nom, et sans lui les deux lignes seraient
 * identiques.
 *
 * Requete vide : les six premieres, soit les plus recentes — de quoi y revenir
 * sans rien taper, comme la liste des projets. Le groupe se ferme sur la liste
 * complete (`ALL_COMPARISONS`) des qu'il existe une comparaison, et l'ensemble
 * est reclasse pour que `filterCommands` n'en change pas l'ordre.
 */
export function comparisonCommands(comparisons: ComparisonLike[], query: string): Command[] {
  if (!comparisons.length) return [];
  const items: Command[] = comparisons.map((c) => ({
    id: `comparison:${c.project_id}:${c.dataset_id}:${c.name}`,
    label: c.name,
    hint: c.project_name,
    kind: 'comparison' as const,
    href: comparisonHref(c),
    // `comparison` permet de les lister sans en connaitre une seule, comme
    // `project` pour les projets.
    keywords: [comparisonTitle(c.name), c.project_name, 'comparison', 'comparaison'],
  }));
  return rankCommands(
    [...rankCommands(items, query).slice(0, COMPARISON_RESULT_LIMIT), ALL_COMPARISONS],
    query,
  );
}

/**
 * La page de comparaison ou vit ce resultat, gene deja ouvert.
 *
 * Un dataset produit par une analyse a une URL d'analyse ; un DEG televerse n'en a
 * pas et passe par la route de projet. `?gene=` porte l'IDENTIFIANT, pas le
 * symbole : c'est la cle primaire de la table des DEG, et `geneKeys` la rapproche
 * du symbole cote volcano. Un symbole absent ne casse donc pas le lien.
 */
export function geneHref(hit: GeneSearchResult): string {
  const comparison = encodeURIComponent(hit.comparison_name);
  const base = hit.analysis_id
    ? `/projects/${hit.project_id}/analyses/${hit.analysis_id}/comparisons/${comparison}`
    : `/projects/${hit.project_id}/comparisons/${comparison}`;
  const params = new URLSearchParams({ [PARAM_GENE]: hit.gene_id });
  return `${base}?${params.toString()}`;
}

/** `UP` / `DOWN` du backend ; tout le reste (`NS`, absent) est non significatif. */
export function geneDirection(regulation: string | null | undefined): GeneDirection {
  const value = regulation?.toUpperCase();
  if (value === 'UP') return 'up';
  if (value === 'DOWN') return 'down';
  return 'ns';
}

function formatLogFc(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `log2FC ${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatPadj(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  // En dessous du millieme, l'ecriture decimale ne dit plus rien a l'oeil.
  return `padj ${value < 0.001 ? value.toExponential(1) : value.toFixed(3)}`;
}

/**
 * Un resultat de recherche de gene = une commande « GENE · comparaison · projet ».
 *
 * Le libelle nomme OU le gene a ete trouve, parce que le meme gene revient dans
 * chaque comparaison : sans la comparaison et le projet, six lignes « TP53 »
 * identiques ne se distingueraient pas. Les chiffres vont dans la precision.
 */
export function buildGeneCommands(hits: GeneSearchResult[]): Command[] {
  return hits.map((hit) => ({
    id: `gene:${hit.dataset_id}:${hit.comparison_name}:${hit.gene_id}`,
    label: [hit.gene_symbol, hit.comparison_name, hit.project_name].join(' · '),
    hint: [formatLogFc(hit.log_fc), formatPadj(hit.padj)].filter(Boolean).join(' · ') || undefined,
    kind: 'gene' as const,
    direction: geneDirection(hit.regulation),
    href: geneHref(hit),
  }));
}
