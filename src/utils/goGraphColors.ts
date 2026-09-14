import type { Palette } from '@/utils/chartPalettes';
import { mixColors as mix } from '@/utils/chartScales';

/**
 * Les decisions de couleur du graphe d'enrichissement GO.
 *
 * Elles vivent hors du composant pour une raison concrete : `GOForceGraph`
 * importe d3, que Jest ne transforme pas — toute fonction qui y reste est donc
 * intestable. C'est le meme choix que `cytoscapeAdapters`, et la meme raison
 * que celle deja ecrite dans son test : le rendu n'est pas verifiable, la
 * decision doit donc l'etre.
 */

export type NamespaceKey =
  | 'biological_process'
  | 'molecular_function'
  | 'cellular_component';

/**
 * Les trois espaces de noms prennent les trois premiers crans de la palette
 * categorielle — ceux que la selection gloutonne a places en tete, donc les
 * plus separes entre eux sous les trois dichromaties simulees.
 *
 * Ils etaient ecrits en dur, et le premier valait `#4f46e5` : l'indigo
 * INTERACTIF du produit employe comme couleur de donnee. La regle de couleur
 * reserve l'indigo aux controles.
 */
const NS_SLOT: Record<NamespaceKey, number> = {
  biological_process: 0,
  molecular_function: 1,
  cellular_component: 2,
};

export function namespaceColor(ns: string, palette: Palette): string {
  const slot = NS_SLOT[ns as NamespaceKey];
  return slot === undefined ? palette.ns : palette.categorical[slot];
}

/**
 * La couleur d'un terme : celle de son espace de noms, fondue vers le gris
 * « non significatif » a mesure que la significativite baisse.
 *
 * Le fondu visait `#94a3b8`, un gris CLAIR, et le non-significatif `#cbd5e1`,
 * plus clair encore. Sur panneau sombre la rampe etait donc exactement
 * INVERSEE : les termes non significatifs ressortaient a 12,08:1 et les plus
 * significatifs a 2,85:1, sous le plancher non-textuel de 3:1. Le bruit criait
 * plus fort que le signal — le defaut le plus couteux pour un graphe dont
 * l'objet est de montrer ce qui ressort.
 *
 * En visant `palette.ns`, deliberement bas en contraste dans LES DEUX themes,
 * la rampe redevient monotone. Mesure sur les six cas (3 espaces x 2 themes) :
 * contraste strictement decroissant, sommet entre 3,10 et 10,21:1. Que le bas
 * passe sous 3:1 est voulu : le non-significatif doit reculer, c'est la raison
 * d'etre de `--chart-ns`.
 */
export function fdrToColor(
  fdr: number | null | undefined,
  ns: string,
  palette: Palette,
): string {
  const base = namespaceColor(ns, palette);
  if (!fdr) return palette.ns;
  if (fdr <= 1e-6) return base;
  if (fdr <= 1e-4) return mix(base, palette.ns, 0.2);
  if (fdr <= 0.01) return mix(base, palette.ns, 0.45);
  if (fdr <= 0.05) return mix(base, palette.ns, 0.65);
  return palette.ns;
}
