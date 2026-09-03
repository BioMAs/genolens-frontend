'use client';

/**
 * The persistent panel beside the volcano: what is selected, and what is known about it.
 *
 * Three states, branched on the selection: nothing, one gene, a set. This file is now only the
 * shell and the branch — the two bodies live in `GeneDetailCard` and `MultiSelectionCard`.
 */

import { Dataset } from '@/types';
import { useSelection } from '@/contexts/ComparisonSelectionContext';
import GeneDetailCard from './GeneDetailCard';
import MultiSelectionCard from './MultiSelectionCard';

interface Props {
  dataset: Dataset;
  comparisonName: string;
  matrixDataset?: Dataset;
  enrichmentDataset?: Dataset;
  sampleIds?: string[];
  conditionBySample?: Record<string, string>;
  /** `gene_id -> symbol`, so an accession can still be shown, and queried, by name. */
  geneNameMap?: Record<string, string>;
}

export default function SelectionCard({
  dataset,
  comparisonName,
  matrixDataset,
  enrichmentDataset,
  sampleIds,
  conditionBySample,
  geneNameMap,
}: Props) {
  const selection = useSelection();

  const shell = (children: React.ReactNode) => (
    <aside
      className="gl-card p-4"
      style={{
        borderRadius: 'var(--radius-panel)',
        position: 'sticky',
        top: 'calc(var(--topbar-height) + 1rem)',
      }}
      aria-label="Selected genes"
      data-testid="selection-card"
    >
      {children}
    </aside>
  );

  if (selection.genes.length === 0) {
    return shell(
      <div className="py-6 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          No gene selected
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Click a point in the volcano to see its fold change and significance here.
        </p>
      </div>
    );
  }

  // A focused gene wins: it is what the user last pointed at. Otherwise a set describes itself.
  if (!selection.focusedGene && selection.genes.length > 1) {
    return shell(<MultiSelectionCard dataset={dataset} comparisonName={comparisonName} />);
  }

  const gene = selection.focusedGene ?? selection.genes[0];

  return shell(
    <GeneDetailCard
      gene={gene}
      symbol={geneNameMap?.[gene]}
      dataset={dataset}
      comparisonName={comparisonName}
      matrixDataset={matrixDataset}
      enrichmentDataset={enrichmentDataset}
      sampleIds={sampleIds}
      conditionBySample={conditionBySample}
    />
  );
}
