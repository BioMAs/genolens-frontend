/**
 * Le catalogue de la palette de commandes.
 *
 * Module PUR, sans React : la construction de la liste et son filtrage sont les
 * deux endroits ou une palette se trompe — un element absent, un element
 * propose hors contexte, un classement qui enterre ce qu'on cherche. Isoles
 * ici, ils se testent ; noyes dans le composant, ils ne se verifient qu'a la
 * main, une fois sur deux.
 */

export type CommandKind = 'navigate' | 'project' | 'gene' | 'action';

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
}

export interface CommandGroup {
  heading: string;
  items: Command[];
}

/** Les routes de premier niveau, celles que la barre laterale expose. */
const ROUTES: Array<{ href: string; label: string; keywords: string[] }> = [
  { href: '/dashboard', label: 'Dashboard', keywords: ['home', 'accueil', 'start'] },
  { href: '/projects', label: 'Projects', keywords: ['projets', 'datasets', 'studies'] },
  { href: '/comparisons', label: 'Comparisons', keywords: ['deg', 'contrast', 'comparaisons'] },
  { href: '/tools', label: 'Tools', keywords: ['ontology', 'power analysis', 'outils'] },
  { href: '/docs', label: 'Documentation', keywords: ['help', 'guide', 'aide', 'docs'] },
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
  actions: CommandActions;
}): CommandGroup[] {
  const { projects, actions } = opts;

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

/** Filtre et ordonne, en preservant les groupes et en jetant ceux qui se vident. */
export function filterCommands(groups: CommandGroup[], query: string): CommandGroup[] {
  if (!query.trim()) return groups;
  return groups
    .map((group) => ({
      heading: group.heading,
      items: group.items
        .map((item) => ({ item, score: scoreCommand(item, query) }))
        .filter((s): s is { item: Command; score: number } => s.score !== null)
        // Tri STABLE sur le score seul : a score egal, l'ordre de declaration
        // est conserve, et c'est lui qui porte la hierarchie du produit.
        .sort((a, b) => b.score - a.score)
        .map((s) => s.item),
    }))
    .filter((group) => group.items.length > 0);
}

/** La liste a plat, dans l'ordre d'affichage — c'est elle que le clavier parcourt. */
export function flattenCommands(groups: CommandGroup[]): Command[] {
  return groups.flatMap((g) => g.items);
}
