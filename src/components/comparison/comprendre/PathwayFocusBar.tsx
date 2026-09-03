'use client';

/**
 * The pathway currently being looked through, and the two ways out of it.
 *
 * This bar is the visible half of what makes merging the screens *useful* rather than merely
 * compact. Clicking an enriched term does not navigate: it re-seeds the network and pre-fills
 * the signature panel, both a scroll away on the same screen. Without the merge that would have
 * to be a navigation, and the connection would be invisible.
 *
 * The way out is explicit and user-initiated — "show these in Explorer" — never automatic.
 */

import { Focus, X } from 'lucide-react';
import {
  useComparisonActions,
  useFocusedTerm,
} from '@/contexts/ComparisonSelectionContext';

interface Props {
  /** Hands the term's genes to Explorer as a selection. */
  onShowInExplorer: (genes: string[], label: string) => void;
}

export default function PathwayFocusBar({ onShowInExplorer }: Props) {
  const term = useFocusedTerm();
  const { focusTerm } = useComparisonActions();

  if (!term) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
      style={{
        background: 'color-mix(in srgb, var(--sl-teal) 10%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-control)',
      }}
      data-testid="pathway-focus-bar"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <Focus className="h-4 w-4 shrink-0" style={{ color: 'var(--sl-teal-dark)' }} />
        <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }} title={term.name}>
          {term.name}
        </span>
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {term.genes.length.toLocaleString('en-US')} gene
          {term.genes.length === 1 ? '' : 's'}
        </span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {term.genes.length > 0 ? (
          <button
            type="button"
            onClick={() => onShowInExplorer(term.genes, term.name)}
            className="text-xs underline"
            style={{ color: 'var(--sl-teal-dark)' }}
          >
            Show these {term.genes.length.toLocaleString('en-US')} genes in Explore
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => focusTerm(null)}
          aria-label="Stop looking through this pathway"
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
