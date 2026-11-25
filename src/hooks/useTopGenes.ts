'use client';

/**
 * Les gènes qui ont le plus bougé dans une comparaison, de chaque côté.
 *
 * Ne fait aucune requête : il trie le nuage du volcano que `useVolcanoPoints` garde déjà en
 * cache, sous une clé sans seuils. Le moindre lecteur de plus ne coûte donc rien, et un
 * changement de seuil de la page se répercute ici sans appel réseau.
 *
 * Même définition de « significatif » que le reste de l'écran (`isSignificant`, comparaisons
 * strictes, seuils du contexte) : la liste ne peut pas contredire le volcano ni les compteurs.
 *
 * Tri : `padj` croissant, puis `|log2FC|` décroissant à `padj` égal. Les `padj` de très gros
 * jeux se tassent sur quelques valeurs plancher ; sans départage, l'ordre à égalité serait
 * celui du nuage, c'est-à-dire arbitraire.
 */

import { useMemo } from 'react';
import { useThresholds } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { isSignificant, UNKNOWN_GENE, type VolcanoPoint } from '@/utils/volcano';

export interface TopGenes {
  /** Surexprimés (`x > 0`), du plus significatif au moins significatif. */
  up: VolcanoPoint[];
  /** Sous-exprimés (`x < 0`), du plus significatif au moins significatif. */
  down: VolcanoPoint[];
  isLoading: boolean;
}

const rank = (a: VolcanoPoint, b: VolcanoPoint) => a.padj - b.padj || Math.abs(b.x) - Math.abs(a.x);

export function useTopGenes(datasetId: string, comparisonName: string, n: number = 8): TopGenes {
  const thresholds = useThresholds();
  const { data, isLoading } = useVolcanoPoints(datasetId, comparisonName);

  const points = data?.points;

  const { up, down } = useMemo(() => {
    const ups: VolcanoPoint[] = [];
    const downs: VolcanoPoint[] = [];

    for (const point of points ?? []) {
      // `Unknown` est la sentinelle du backend pour « pas de colonne gène », pas un gène.
      if (!point.gene || point.gene === UNKNOWN_GENE) continue;
      if (!isSignificant(point, thresholds)) continue;
      if (point.x > 0) ups.push(point);
      else if (point.x < 0) downs.push(point);
    }

    return { up: ups.sort(rank).slice(0, n), down: downs.sort(rank).slice(0, n) };
  }, [points, thresholds, n]);

  return { up, down, isLoading };
}
