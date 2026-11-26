'use client';

/**
 * La fiche d'un processus : ce que c'est, et ce que ses gènes font dans cette comparaison.
 *
 * L'identifiant (le `GO:` du processus), son FDR et le nombre de ses gènes, puis la table de ces
 * gènes avec le log2FC et le padj que le volcano de la comparaison leur donne, du plus significatif
 * au moins significatif. Un gène est un bouton : il ouvre sa propre fiche. « Select these genes »
 * fait des gènes du processus la sélection, nommée d'après lui, et ouvre le volcano où la carte
 * multi-gènes la décrit — la fiche se ferme alors, le volcano la remplace.
 *
 * **Le FDR** est celui de la ligne d'où la voie vient : la barre du chapitre ou la ligne de la table
 * complète le posent sur la voie regardée (`FocusedTerm.padj`), et la fiche l'imprime tel quel. On
 * ne le cherche pas par identifiant parmi les voies du chapitre : ce serait le FDR d'un autre
 * enrichissement quand la ligne est celle d'un sens (hausse, baisse), et rien pour une voie hors
 * du classement. Une voie sans padj n'en montre pas, et on ne l'invente pas.
 *
 * **La jointure.** Les gènes d'un processus sont des symboles ; le volcano nomme les siens par
 * identifiant ou par symbole selon le jeu. On les rapproche par `buildGeneIndex`, qui connaît les
 * deux noms d'un gène, et un clic donne à la sélection la clé que le volcano emploie — celle que
 * `GeneDetailCard` retrouvera dans le nuage.
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useComparisonActions, type FocusedTerm } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { buildGeneIndex, normalizeGeneKey } from '@/utils/geneKeys';
import type { VolcanoPoint } from '@/utils/volcano';
import type { FocusContext } from './FocusDialog';
import { formatLog2fc, formatPadj } from './formatStats';
import type { FocusKind } from './readingRoutes';

interface ProcessSheetProps {
  term: FocusedTerm;
  context: FocusContext;
  /** Ouvre une vue agrandie : « Select these genes » ouvre le volcano. */
  onOpenFocus: (kind: FocusKind) => void;
  /** Ferme la fiche (la page lâche le gène et la voie regardés). */
  onClose: () => void;
}

interface GeneRow {
  /** Le gène tel que le processus l'écrit. */
  name: string;
  /** Le point du volcano, quand le gène y est. */
  point: VolcanoPoint | null;
}

/** Du plus significatif au moins significatif ; un gène absent du volcano en dernier. */
function byPadj(a: GeneRow, b: GeneRow): number {
  if (a.point && b.point) return a.point.padj - b.point.padj || a.name.localeCompare(b.name);
  if (a.point) return -1;
  if (b.point) return 1;
  return a.name.localeCompare(b.name);
}

export default function ProcessSheet({ term, context, onOpenFocus, onClose }: ProcessSheetProps) {
  const { degDataset, actualComparisonName, geneMap } = context;
  const { selectGenes, setFocusedGene } = useComparisonActions();

  const { data: cloud, isLoading, isError } = useVolcanoPoints(degDataset.id, actualComparisonName);
  const fdr = term.padj ?? undefined;

  const rows = useMemo<GeneRow[]>(() => {
    const byId = new Map<string, VolcanoPoint>();
    const entries: Array<{ id: string; symbol?: string }> = [];
    for (const point of cloud?.points ?? []) {
      const id = normalizeGeneKey(point.gene);
      if (!id || byId.has(id)) continue;
      byId.set(id, point);
      entries.push({ id: point.gene, symbol: geneMap.nameByGene[point.gene] });
    }
    const index = buildGeneIndex(entries);
    return term.genes
      .map((name) => {
        const hit = index.resolve(name);
        return { name, point: (hit && byId.get(hit.id)) || null };
      })
      .sort(byPadj);
  }, [cloud?.points, geneMap.nameByGene, term.genes]);

  // La clé du volcano quand le gène y est, sinon le nom du processus : une fiche sans statistiques
  // vaut mieux qu'un clic qui ne fait rien.
  const openGene = ({ name, point }: GeneRow) => {
    const key = point?.gene ?? name;
    selectGenes([key], 'table');
    setFocusedGene(key);
  };

  // La sélection d'abord ; la fermeture lâche ensuite le gène regardé (un processus d'un seul gène
  // le ferait regarder, et la fiche de ce gène remplacerait celle-ci) ; puis le volcano s'ouvre.
  const selectAll = () => {
    selectGenes(term.genes, 'pathway', term.name);
    onClose();
    onOpenFocus('volcano');
  };

  const count = term.genes.length;

  let statsNote = null;
  if (isLoading) {
    statsNote = (
      <p role="status" className="mb-2 text-caption text-muted">
        Loading…
      </p>
    );
  } else if (isError) {
    statsNote = (
      <p className="mb-2 text-caption text-secondary">
        The fold changes could not be read, so the genes are listed without them.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-caption text-secondary">
        {term.id && (
          <div>
            <dt className="sr-only">Identifier</dt>
            <dd className="font-mono">{term.id}</dd>
          </div>
        )}
        {fdr !== undefined && (
          <div>
            <dt className="sr-only">Adjusted p</dt>
            <dd>
              FDR <span className="font-mono tabular-nums">{formatPadj(fdr)}</span>
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">Genes</dt>
          <dd>
            {count.toLocaleString('en-US')} gene{count === 1 ? '' : 's'}
          </dd>
        </div>
      </dl>

      <Button variant="outline" size="sm" disabled={count === 0} onClick={selectAll}>
        Select these genes
      </Button>

      <div className="border-t border-line pt-4">
        {statsNote}
        {count === 0 ? (
          <p className="text-caption text-secondary">This process lists no genes.</p>
        ) : (
          <table className="w-full text-left text-caption">
            <caption className="sr-only">Genes of {term.name}, most significant first</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Gene
                </th>
                <th scope="col" className="px-3 py-1 text-right font-medium">
                  log2FC
                </th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">
                  adj. p
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {rows.map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <td className="py-1 pr-3">
                    <button
                      type="button"
                      onClick={() => openGene(row)}
                      className="rounded-sm font-mono text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1 text-right font-mono tabular-nums',
                      !row.point ? 'text-muted' : row.point.x > 0 ? 'text-up-strong' : 'text-down-strong'
                    )}
                  >
                    {row.point ? formatLog2fc(row.point.x) : '—'}
                  </td>
                  <td className="py-1 pl-3 text-right font-mono tabular-nums text-secondary">
                    {row.point ? formatPadj(row.point.padj) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
