'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import VolcanoPanel from '@/components/comparison/explorer/VolcanoPanel';
import type { Dataset } from '@/types';
import type { SignificanceSummary } from '@/utils/volcano';
import { formatCount } from '../answers';
import ReadingChapter from '../ReadingChapter';
import type { FocusKind } from '../readingRoutes';

interface CountsChapterProps {
  /** `null` tant que le nuage du volcano n'est pas calculé. */
  summary: SignificanceSummary | null;
  /** Gènes testés ; `null` quand on ne le sait pas. Jamais `summary.total`, que le serveur ne définit pas ainsi partout. */
  tested: number | null;
  degDataset: Dataset;
  comparisonName: string;
  onOpenFocus: (kind: FocusKind) => void;
}

/** La couleur dit le sens, la flèche et le mot le disent aussi : jamais la couleur seule. */
const COUNT = {
  up: { Icon: ArrowUp, label: 'genes up', number: 'text-up', caption: 'text-up-strong' },
  down: { Icon: ArrowDown, label: 'genes down', number: 'text-down', caption: 'text-down-strong' },
} as const;

function Count({ direction, value }: { direction: keyof typeof COUNT; value: number }) {
  const { Icon, label, number, caption } = COUNT[direction];
  return (
    <div>
      {/* Un grand chiffre : l'un des trois usages que la spec réserve à Newsreader. */}
      <p className={cn('font-display text-display tabular-nums', number)}>{formatCount(value)}</p>
      <p className={cn('flex items-center gap-1 text-body-sm font-medium', caption)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
    </div>
  );
}

/**
 * Chapitre 1, « How many genes change? » : deux grands chiffres (up, down), le nombre de gènes
 * testés, puis le volcano existant, inchangé.
 *
 * Tout arrive de la page, qui calcule `summary` et `tested` une seule fois pour la réponse de la
 * colonne vertébrale et pour ce chapitre : les deux ne peuvent pas se contredire. Sans `summary`
 * on dit qu'on compte, on n'écrit pas des zéros ; sans `tested`, le membre de phrase disparaît
 * plutôt que de prendre un chiffre voisin.
 */
export default function CountsChapter({
  summary,
  tested,
  degDataset,
  comparisonName,
  onOpenFocus,
}: CountsChapterProps) {
  return (
    <ReadingChapter
      part="counts"
      number={1}
      title="How many genes change?"
      action={
        <Button variant="outline" size="sm" onClick={() => onOpenFocus('volcano')}>
          Open the volcano
        </Button>
      }
    >
      {summary ? (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Count direction="up" value={summary.up} />
          <Count direction="down" value={summary.down} />
          {tested !== null && (
            <p className="pb-0.5 text-body-sm text-secondary">{formatCount(tested)} genes tested</p>
          )}
        </div>
      ) : (
        <p role="status" className="text-body-sm text-muted">
          Counting genes…
        </p>
      )}
      <VolcanoPanel dataset={degDataset} comparisonName={comparisonName} />
    </ReadingChapter>
  );
}
