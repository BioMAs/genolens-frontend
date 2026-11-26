'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useComparisonActions } from '@/contexts/ComparisonSelectionContext';
import { useTopGenes } from '@/hooks/useTopGenes';
import type { VolcanoPoint } from '@/utils/volcano';
import ReadingChapter from '../ReadingChapter';
import type { FocusKind } from '../readingRoutes';

interface GenesChapterProps {
  datasetId: string;
  comparisonName: string;
  onOpenFocus: (kind: FocusKind) => void;
}

/** `+3.46` / `−2.50` : le signe est écrit, le moins est le vrai (U+2212), pas un trait d'union. */
function formatLog2fc(x: number): string {
  return `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
}

/**
 * Le padj d'un gène du classement : exponentiel quand il est petit, décimal sinon. Un padj que le
 * serveur a arrondi à zéro reste `0`, pas `0.0e+0`.
 */
function formatPadj(padj: number): string {
  if (padj === 0) return '0';
  return padj < 0.001 ? padj.toExponential(1) : padj.toFixed(3);
}

const SIDE = {
  up: { Icon: ArrowUp, title: 'Rising most', empty: 'No gene rises at these thresholds', fc: 'text-up-strong' },
  down: { Icon: ArrowDown, title: 'Falling most', empty: 'No gene falls at these thresholds', fc: 'text-down-strong' },
} as const;

function GeneTable({
  side,
  genes,
  onPick,
}: {
  side: keyof typeof SIDE;
  genes: VolcanoPoint[];
  onPick: (gene: string) => void;
}) {
  const { Icon, title, empty, fc } = SIDE[side];

  if (genes.length === 0) {
    return (
      <div>
        <p className="flex items-center gap-2 pb-2 text-title text-primary">
          <Icon className="h-4 w-4" aria-hidden />
          {title}
        </p>
        <p className="text-body-sm text-secondary">{empty}</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-body-sm">
      <caption className="pb-2 text-left text-title text-primary">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden />
          {title}
        </span>
      </caption>
      <thead>
        <tr className="border-b border-line text-caption text-muted">
          <th scope="col" className="py-1.5 pr-3 font-medium">
            Gene
          </th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">
            log2FC
          </th>
          <th scope="col" className="py-1.5 pl-3 text-right font-medium">
            adj. p
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-subtle">
        {genes.map((point, index) => (
          <tr key={`${point.gene}-${index}`}>
            <td className="py-1 pr-3">
              <button
                type="button"
                onClick={() => onPick(point.gene)}
                className="rounded-sm font-mono text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {point.gene}
              </button>
            </td>
            <td className={cn('px-3 py-1 text-right font-mono tabular-nums', fc)}>{formatLog2fc(point.x)}</td>
            <td className="py-1 pl-3 text-right font-mono tabular-nums text-secondary">{formatPadj(point.padj)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Chapitre 2, « Which genes matter most? » : les huit gènes qui montent le plus et les huit qui
 * baissent le plus, côte à côte.
 *
 * La liste vient de `useTopGenes`, qui trie le nuage du volcano déjà en cache aux seuils de la
 * page : elle ne peut pas contredire le volcano ni les comptes. Un symbole est un bouton qui
 * donne le gène à regarder (`setFocusedGene`) ; le tableau complet et ses téléchargements sont
 * dans la vue agrandie.
 *
 * Tant que le nuage n'est pas là on dit qu'on charge, on n'écrit pas « aucun gène ». Quand un
 * seul côté est vide, l'autre reste affiché : « aucun gène ne baisse » est une information.
 */
export default function GenesChapter({ datasetId, comparisonName, onOpenFocus }: GenesChapterProps) {
  const { up, down, isLoading } = useTopGenes(datasetId, comparisonName);
  const { setFocusedGene } = useComparisonActions();

  let body;
  if (isLoading) {
    body = (
      <p role="status" className="text-body-sm text-muted">
        Loading…
      </p>
    );
  } else if (up.length === 0 && down.length === 0) {
    body = <p className="text-body-sm text-secondary">No gene passes the thresholds</p>;
  } else {
    body = (
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <GeneTable side="up" genes={up} onPick={setFocusedGene} />
        <GeneTable side="down" genes={down} onPick={setFocusedGene} />
      </div>
    );
  }

  return (
    <ReadingChapter
      part="genes"
      number={2}
      title="Which genes matter most?"
      action={
        <Button variant="outline" size="sm" onClick={() => onOpenFocus('table')}>
          All genes
        </Button>
      }
    >
      {body}
    </ReadingChapter>
  );
}
