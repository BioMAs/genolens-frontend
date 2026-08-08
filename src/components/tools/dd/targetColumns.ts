/**
 * Formatage et dérivation des colonnes d'axes, partagés par les deux tableaux de cibles.
 *
 * Extraction délibérée, et non un effet de bord d'une réutilisation forcée : `TargetTable`
 * (mode A) et `SignatureHitsTable` (mode B) affichent les mêmes colonnes de score mais des
 * bandeaux différents — le premier porte les quatre compteurs d'exclusion du classement, le
 * second une p-value et un percentile moyen. Tordre l'un pour servir l'autre aurait obligé à
 * fabriquer de faux compteurs ; ce qu'ils partagent réellement, c'est ceci.
 */
import { DdTarget } from '@/types/drugDiscovery';

export function fmt(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/**
 * Noms d'axes présents dans un ensemble de cibles, triés.
 *
 * Dérivés des données et non d'une liste en dur : un septième axe ajouté en amont doit
 * apparaître sans changement ici, et un axe retiré ne doit pas laisser une colonne vide.
 */
export function axisNames(targets: DdTarget[]): string[] {
  const names = new Set<string>();
  targets.forEach((target) => {
    Object.keys(target.subscores).forEach((axis) => names.add(axis));
  });
  return Array.from(names).sort();
}
