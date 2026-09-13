import type { PaletteMode } from '@/utils/chartPalettes';

/**
 * Les echelles continues et discretes des graphiques.
 *
 * Module PUR, comme `chartPalettes` : Plotly ne resout pas `var()` (il stylise
 * en JS et dessine en canvas/WebGL), donc une echelle doit produire des
 * litteraux, et une fonction qui prend son theme en argument se teste dans un
 * diff au lieu de se verifier a l'oeil sur un canvas.
 *
 * Trois systemes coexistaient : les echelles nommees de Plotly ('RdBu',
 * 'PiYG'), quatre constantes privees dans `DEGClusteringView`, et un couple
 * dans `heatmapConfig`. Ils sont reunis ici.
 *
 * ── Le defaut que ce module existe pour supprimer ───────────────────────────
 * Les echelles NOMMEES de Plotly ont un point median blanc cuit dedans. En
 * theme sombre, 'RdBu' et 'PiYG' percaient donc un trou blanc au milieu de
 * chaque carte de chaleur — a l'endroit precis ou la donnee ne dit rien. Les
 * stops sont desormais explicites, et le median vaut la surface du panneau :
 * le neutre RECULE au lieu de crier.
 *
 * ── Ce que les mesures ont impose ───────────────────────────────────────────
 * 1. La rampe « sequentielle daltonisme » (#0072B2 → #56B4E9 → #F0E442 →
 *    #E69F00) n'etait PAS monotone en clarte : #F0E442 (OKLab L 0.90) precedait
 *    #E69F00 (L 0.75). Une rampe sequentielle se lit par la clarte ; deux
 *    valeurs differentes y prenaient la meme. Elle est supprimee, pas reparee :
 *    une rampe monotone en clarte est DEJA sure en dichromatie, puisque l'ordre
 *    passe par un canal que tous les dichromates percoivent a l'identique.
 *    Maintenir une rampe parallele « pour daltoniens » leur servait la pire des
 *    deux.
 * 2. Le couple de direction violet/vert de `DEGClusteringView` est mesure
 *    3 a 5 fois MOINS distinguable en dichromatie que le vert/rouge du
 *    produit (dE min 0,056 contre 0,222) — et le violet tombe a 2,21:1 sur
 *    panneau sombre, sous le plancher non-textuel de 3:1. Il perd donc sur les
 *    deux axes a la fois : coherence ET accessibilite. Le mode standard rejoint
 *    la convention du produit ; le mode daltonisme prend le bleu/vermillon de
 *    Wong (dE min 0,307, le meilleur des cinq candidats mesures).
 */

export type ThemeMode = 'light' | 'dark';
export type ColorStops = [number, string][];

/**
 * Le point median. En clair un gris quasi-blanc ; en sombre la surface du
 * panneau, pour que le neutre disparaisse dedans au lieu d'y faire un trou.
 * Les valeurs suivent `--chart-zero`, qu'on ne peut pas lire ici (module pur).
 */
const ZERO: Record<ThemeMode, string> = { light: '#f7f7f7', dark: '#1c2438' };

/**
 * Rampe sequentielle — expression mise a l'echelle, densites, comptages.
 *
 * Monotone en clarte OKLab dans les deux themes (regularite 0,46 / 0,57).
 * La variante sombre releve le bas de la rampe : `#000080` etait a 1,12:1 du
 * panneau sombre, donc les cellules basses s'y dissolvaient — elles ne se
 * lisaient plus comme des cellules.
 */
const SEQUENTIAL: Record<ThemeMode, ColorStops> = {
  light: [
    [0.0, '#000080'], [0.15, '#0c3b6b'], [0.3, '#2e6fa3'], [0.45, '#6e91a8'],
    [0.6, '#a8a878'], [0.75, '#d4c836'], [1.0, '#ffff00'],
  ],
  dark: [
    [0.0, '#1b2a6b'], [0.15, '#25467f'], [0.3, '#2e6fa3'], [0.45, '#5b93b0'],
    [0.6, '#9cae86'], [0.75, '#d4c836'], [1.0, '#fdfb8c'],
  ],
};

/** Divergente — expression centree, z-scores. Bas froid, haut chaud. */
const DIVERGING: Record<PaletteMode, Record<ThemeMode, ColorStops>> = {
  standard: {
    light: [
      [0.0, '#2166ac'], [0.25, '#67a9cf'], [0.4, '#d1e5f0'], [0.5, ZERO.light],
      [0.6, '#fddbc7'], [0.75, '#ef8a62'], [1.0, '#b2182b'],
    ],
    dark: [
      [0.0, '#5fa2dd'], [0.25, '#3d7ab8'], [0.4, '#2b4f7d'], [0.5, ZERO.dark],
      [0.6, '#7d3040'], [0.75, '#bf4a55'], [1.0, '#f08a80'],
    ],
  },
  // Bleu / vermillon de Wong : le seul couple mesure au-dessus de dE 0,30 sous
  // les trois dichromaties simulees.
  colorblind: {
    light: [
      [0.0, '#0072B2'], [0.3, '#88c4e8'], [0.5, ZERO.light],
      [0.7, '#f0a882'], [1.0, '#D55E00'],
    ],
    dark: [
      [0.0, '#5fb4e8'], [0.3, '#2c6f9c'], [0.5, ZERO.dark],
      [0.7, '#a3512a'], [1.0, '#f09460'],
    ],
  },
};

/**
 * Divergente du log2FC — distincte de la precedente a dessein : un ecran qui
 * montre expression ET log2FC cote a cote doit pouvoir dire lequel il regarde.
 *
 * ⚠️ En mode standard, magenta/vert mesure dE 0,068 en deutéranopie : les deux
 * bouts sont pratiquement confondus. C'est le defaut que la bascule daltonisme
 * existe pour corriger, et c'est pourquoi elle est desormais globale et
 * persistee plutot que privee a chaque graphique.
 */
const LOGFC: Record<PaletteMode, Record<ThemeMode, ColorStops>> = {
  standard: {
    light: [
      [0.0, '#c51b7d'], [0.25, '#e9a3c9'], [0.4, '#fde0ef'], [0.5, ZERO.light],
      [0.6, '#e6f5d0'], [0.75, '#a1d76a'], [1.0, '#4d9221'],
    ],
    dark: [
      [0.0, '#e074b4'], [0.25, '#a83e84'], [0.4, '#6b2a55'], [0.5, ZERO.dark],
      [0.6, '#2f5a2a'], [0.75, '#5a9a3f'], [1.0, '#9ed669'],
    ],
  },
  colorblind: DIVERGING.colorblind,
};

/** Direction discrete : deux bandes franches, DOWN puis UP, sans degrade. */
const DIRECTION: Record<PaletteMode, Record<ThemeMode, [string, string]>> = {
  standard: { light: ['#dc2626', '#16a34a'], dark: ['#ef4444', '#22c55e'] },
  colorblind: { light: ['#0072B2', '#D55E00'], dark: ['#5fb4e8', '#f09460'] },
};

/**
 * Rampe de SIGNIFICATIVITE — six paliers discrets, du non-significatif au
 * p < 1e-10. Plus c'est significatif, plus c'est contraste sur le fond.
 *
 * Elle etait unique pour les deux themes, et mesuree elle s'inversait
 * exactement. Contraste sur le fond, du non-significatif au plus significatif :
 *
 *     clair  : 2,54 -> 10,02   (correct)
 *     sombre : 7,06 ->  1,79   (inverse)
 *
 * En theme sombre la voie la PLUS significative etait donc la MOINS visible —
 * sous le plancher de 3:1 — pendant que le bruit criait a 7:1. Ce n'est pas un
 * detail esthetique : c'est le graphique qui ment sur son classement.
 *
 * Discrete et non continue a dessein : les seuils (1,3 / 2 / 3 / 5 / 10 en
 * -log10) sont des conventions de lecture, pas un continuum.
 */
const SIGNIFICANCE: Record<ThemeMode, string[]> = {
  // Contrastes sur blanc : 2,54 · 3,15 · 4,39 · 5,99 · 8,00 · 9,96.
  // Le premier palier significatif valait 2,77:1 — sous le plancher de 3:1.
  // La correction de l'inversion sombre n'avait pas fait verifier le CLAIR,
  // dont les trois crans du bas etaient tasses (2,54 · 2,77 · 3,76). La rampe
  // est reconstruite par fondu depuis `#dc2626` vers le blanc puis vers un
  // rouge tres sombre : les cibles de contraste sont atteintes SANS perdre la
  // coherence de teinte qu'une recherche libre detruisait.
  light: ['#9ca3af', '#e76a6a', '#df3939', '#c12121', '#9e1b1b', '#841616'],
  // Contrastes sur `--surface` sombre : 2,38 · 3,10 · 4,14 · 5,13 · 6,65 · 9,08.
  dark: ['#4a5568', '#a34a4a', '#c85454', '#e06060', '#ef7b7b', '#fba0a0'],
};

export function significanceRamp(theme: ThemeMode = 'light'): string[] {
  return SIGNIFICANCE[theme];
}

/**
 * Fondu lineaire en sRGB entre deux couleurs — `d3.interpolateRgb` sans la
 * dependance a d3, qui n'a pas sa place dans un module pur.
 *
 * Sert a construire une rampe a partir de la palette plutot que de coder des
 * bornes en dur : c'est ce qui permet a une rampe de suivre le theme.
 */
export function mixColors(from: string, to: string, t: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [channels(from), channels(to)];
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function sequentialScale(theme: ThemeMode = 'light'): ColorStops {
  return SEQUENTIAL[theme];
}

export function divergingScale(
  mode: PaletteMode = 'standard',
  theme: ThemeMode = 'light',
): ColorStops {
  return DIVERGING[mode][theme];
}

export function logFCScale(
  mode: PaletteMode = 'standard',
  theme: ThemeMode = 'light',
): ColorStops {
  return LOGFC[mode][theme];
}

/**
 * Les deux couleurs de direction, et l'echelle a deux bandes qui les porte.
 * Le saut se fait sur 0,02 de domaine : assez raide pour lire une frontiere,
 * assez large pour que Plotly ne rende pas un liseré d'interpolation.
 */
export function directionColors(
  mode: PaletteMode = 'standard',
  theme: ThemeMode = 'light',
): { down: string; up: string } {
  const [down, up] = DIRECTION[mode][theme];
  return { down, up };
}

export function directionScale(
  mode: PaletteMode = 'standard',
  theme: ThemeMode = 'light',
): ColorStops {
  const { down, up } = directionColors(mode, theme);
  return [[0, down], [0.49, down], [0.51, up], [1, up]];
}

/**
 * Transforme une liste de couleurs categorielles en echelle a paliers francs,
 * pour une piste d'annotation (condition, cluster) rendue en carte de chaleur.
 * Deplace tel quel depuis `DEGClusteringView` : il etait correct.
 */
export function discreteScale(colors: string[]): ColorStops {
  const n = colors.length;
  if (n === 0) return [[0, ZERO.light], [1, ZERO.light]];
  return colors.flatMap((color, i): ColorStops => [
    [i / n, color],
    [(i + 1) / n, color],
  ]);
}
