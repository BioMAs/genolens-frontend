'use client';

import { useLayoutEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getPalette, type Palette, type PaletteMode } from '@/utils/chartPalettes';
import { usePaletteMode } from '@/contexts/chartPrefs';

/**
 * Le theme des graphiques, sous DEUX formes.
 *
 * Ce n'est pas un detail d'implementation : c'est le coeur de la conception.
 *
 *   - Recharts rend du SVG dans le DOM, et un attribut SVG resout `var()`.
 *     Il consomme donc `CHART_VARS`, des CHAINES `var()`. Consequence : aucune
 *     lecture JS, donc aucun probleme de valeur perimee, aucune memoisation,
 *     aucun re-rendu au changement de theme. Le navigateur re-resout tout seul
 *     quand la classe `.dark` bascule.
 *
 *   - Plotly style en JavaScript et dessine en canvas/WebGL. Il ne resout rien.
 *     Il lui faut des LITTERAUX, donc `readChartTheme()`.
 *
 * 17 fichiers Recharts et 11 rendus SVG/d3 n'appellent donc jamais
 * `readChartTheme()`. Le probleme de lecture perimee n'est pas attenue pour
 * eux : il est SUPPRIME. Seuls les 8 fichiers Plotly et cytoscape resolvent.
 */

export interface ChartTheme {
  /** Encre principale — titres d'axe, valeurs mises en avant. */
  ink: string;
  /** Encre discrete — graduations, libelles secondaires. */
  inkMuted: string;
  inkSubtle: string;
  /** Grille : toujours en retrait, elle ne doit jamais concurrencer la donnee. */
  grid: string;
  axis: string;
  surface: string;
  surfaceRaised: string;
  hover: string;
  accent: string;
  /** Fond d'accent, pour les rampes de legende. */
  accentSoft: string;
  /** Direction de regulation. Reserve a la donnee, jamais a la chrome. */
  up: string;
  down: string;
  ns: string;
  zero: string;
  /** Famille typographique, pour que Plotly cesse de dessiner en Open Sans. */
  fontFamily: string;
}

/**
 * Forme `var()` — Recharts, SVG fait main, d3.
 *
 * `d3` dessine aussi du SVG via `.attr('fill', …)` : il prend ces chaines
 * directement, sans resolution.
 */
export const CHART_VARS: Readonly<ChartTheme> = Object.freeze({
  ink: 'var(--text-primary)',
  inkMuted: 'var(--text-muted)',
  inkSubtle: 'var(--text-secondary)',
  grid: 'var(--border-subtle)',
  axis: 'var(--border)',
  surface: 'var(--surface)',
  surfaceRaised: 'var(--surface-raised)',
  hover: 'var(--hover-overlay)',
  accent: 'var(--sl-purple)',
  accentSoft: 'var(--sl-purple-light)',
  up: 'var(--chart-up)',
  down: 'var(--chart-down)',
  ns: 'var(--chart-ns)',
  zero: 'var(--chart-zero)',
  fontFamily: 'var(--font-dm-sans)',
});

/**
 * Table de repli, par theme.
 *
 * Elle sert a deux choses, et la seconde est la plus importante :
 *   - amorcer l'etat au PREMIER rendu, avant toute lecture du DOM. Le premier
 *     cadre est ainsi deja JUSTE, et pas seulement non plante — c'est ce qui
 *     evite qu'un `paper_bgcolor` blanc apparaisse une image avant d'etre
 *     corrige.
 *   - donner des valeurs deterministes sous jsdom, qui ne resout pas les
 *     proprietes personnalisees declarees dans une feuille de style.
 *
 * Elle doit rester alignee sur globals.css. `scripts/check-chart-tokens.mjs`
 * le verifie.
 */
const FALLBACK: Record<'light' | 'dark', ChartTheme> = {
  light: {
    ink: '#131629', inkMuted: '#8b93a0', inkSubtle: '#5b6472',
    grid: '#edeff2', axis: '#edeff2',
    surface: '#ffffff', surfaceRaised: '#ffffff', hover: '#f4f5f8',
    accent: '#4f46e5',
    accentSoft: '#eef0ff',
    up: '#16a34a', down: '#dc2626', ns: '#c7ccd4', zero: '#f7f7f7',
    fontFamily: 'Geist, system-ui, sans-serif',
  },
  dark: {
    ink: '#dde4ee', inkMuted: '#5a6a82', inkSubtle: '#8898ae',
    grid: '#171e30', axis: '#1f2840',
    surface: '#131720', surfaceRaised: '#1c2438', hover: '#1c2438',
    accent: '#4f46e5',
    accentSoft: 'rgba(79, 70, 229, 0.16)',
    up: '#22c55e', down: '#ef4444', ns: '#4a5568', zero: '#1c2438',
    fontFamily: 'Geist, system-ui, sans-serif',
  },
};

const VAR_NAMES: Record<keyof ChartTheme, string> = {
  ink: '--text-primary',
  inkMuted: '--text-muted',
  inkSubtle: '--text-secondary',
  grid: '--border-subtle',
  axis: '--border',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  hover: '--hover-overlay',
  accent: '--sl-purple',
  accentSoft: '--sl-purple-light',
  up: '--chart-up',
  down: '--chart-down',
  ns: '--chart-ns',
  zero: '--chart-zero',
  fontFamily: '--font-dm-sans',
};

/**
 * Cache par theme.
 *
 * L'IDENTITE de l'objet compte autant que sa valeur : Plotly relance une mise
 * en page quand l'objet `layout` change d'identite, ce qui est un cout reel sur
 * le nuage de volcan rendu en `scattergl`. Renvoyer un objet neuf a chaque
 * rendu provoquerait une re-mise en page a chaque frappe ailleurs dans l'app.
 */
const cache = new Map<'light' | 'dark', ChartTheme>();

/** Vide le cache. Utile aux tests, et si les tokens changent a chaud. */
export function clearChartThemeCache(): void {
  cache.clear();
}

/**
 * Resout les tokens en litteraux. Pour Plotly et cytoscape uniquement.
 *
 * Generalise `readGraphTheme()` de cytoscapeAdapters, qui avait deja le bon
 * motif — getComputedStyle + trim + repli.
 */
export function readChartTheme(root?: HTMLElement | null): ChartTheme {
  const el = root ?? (typeof document === 'undefined' ? null : document.documentElement);
  const mode: 'light' | 'dark' =
    el?.classList.contains('dark') || el?.closest?.('.dark') ? 'dark' : 'light';

  const cached = cache.get(mode);
  if (cached) return cached;
  if (!el) return FALLBACK[mode];

  const computed = getComputedStyle(el);
  const read = (key: keyof ChartTheme) =>
    computed.getPropertyValue(VAR_NAMES[key]).trim() || FALLBACK[mode][key];

  // Construction explicite plutot que `Object.fromEntries` : ce dernier produit
  // un `{[k: string]: string}` dont TypeScript ne peut pas deduire la forme,
  // et la conversion forcee masquerait une cle oubliee.
  const theme: ChartTheme = {
    ink: read('ink'),
    inkMuted: read('inkMuted'),
    inkSubtle: read('inkSubtle'),
    grid: read('grid'),
    axis: read('axis'),
    surface: read('surface'),
    surfaceRaised: read('surfaceRaised'),
    hover: read('hover'),
    accent: read('accent'),
    accentSoft: read('accentSoft'),
    up: read('up'),
    down: read('down'),
    ns: read('ns'),
    zero: read('zero'),
    fontFamily: read('fontFamily'),
  };

  cache.set(mode, theme);
  return theme;
}

/**
 * Le theme resolu, reactif au basculement clair/sombre.
 *
 * `useLayoutEffect` et non `useEffect` : ThemeContext pose la classe `.dark`
 * dans un effet, donc la lecture doit avoir lieu APRES ce commit mais AVANT la
 * peinture — sinon le graphique apparait une image dans l'ancien theme.
 *
 * L'etat initial vient de la table de repli et non d'une lecture : sous rendu
 * serveur il n'y a pas de DOM, et au premier rendu client la classe peut ne pas
 * etre encore posee.
 */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [resolved, setResolved] = useState<ChartTheme>(() => FALLBACK[theme]);

  // La regle « pas de setState dans un effet » est juste en general : elle evite
  // un rendu en cascade. C'est ici l'exception qu'elle prevoit, et il n'y a pas
  // de contournement : ThemeContext pose la classe `.dark` DANS un effet, donc
  // la valeur resolue ne peut pas etre connue pendant le rendu. Lire le DOM
  // pendant le rendu donnerait l'ancien theme pour une image, ce qui est
  // exactement le scintillement qu'on cherche a eviter.
  //
  // Le cout est borne : readChartTheme est memoise par theme, donc ce second
  // rendu n'a lieu qu'au basculement clair/sombre, pas a chaque rendu.
  useLayoutEffect(() => {
    // La directive s'ancre a la ligne SUIVANTE, et la regle pointe l'appel a
    // setState, pas l'effet qui le contient.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(readChartTheme());
  }, [theme]);

  return resolved;
}

/**
 * La palette de donnees, resolue pour le theme courant.
 *
 * Le hook vit ICI et non dans chartPalettes : ce module-la est importe par neuf
 * fichiers, et lui faire dependre du contexte React le rendrait inutilisable
 * hors composant — en plus d'alourdir chaque test qui le touche.
 *
 * A preferer a `getPalette` dans un composant : oublier le second argument
 * laisserait silencieusement les couleurs du theme clair sur fond sombre, ce
 * qui est precisement le defaut corrige ici.
 */
export function useChartPalette(mode?: PaletteMode): Palette {
  const { theme } = useTheme();
  // Sans argument, la preference de l'utilisateur s'applique. C'est ce qui fait
  // que les quatre bascules concurrentes deviennent une seule : un appelant qui
  // ne dit rien obtient le bon mode.
  const preferred = usePaletteMode();
  return getPalette(mode ?? preferred, theme);
}
