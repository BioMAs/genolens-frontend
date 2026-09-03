/**
 * Tier 3 of the cross-filter: the passive one.
 *
 * A selection made in Explore becomes legible in the enrichment table without anyone
 * navigating anywhere — each row says how much of the pathway is in it. The number is exactly
 * the kind of claim that can quietly be wrong, so it is pinned here.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';
import GOEnrichmentTable from '@/components/GOEnrichmentTable';

jest.mock('@/components/BookmarkButton', () => {
  const Stub = () => <button type="button">bookmark</button>;
  Stub.displayName = 'BookmarkButton';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/ExportMenu', () => {
  const Stub = () => <button type="button">Export</button>;
  Stub.displayName = 'ExportMenu';
  return { __esModule: true, default: Stub };
});

const term = (go_id: string, go_name: string, study_genes: string[]) => ({
  go_id,
  go_name,
  namespace: 'biological_process',
  pvalue: 1e-5,
  fdr: 1e-4,
  enrichment_ratio: 2,
  study_count: study_genes.length,
  study_genes,
  background_count: 100,
});

const TERMS = [
  term('GO:1', 'Apoptotic process', ['TP53', 'MDM2', 'BAX', 'CASP3']),
  term('GO:2', 'Cell cycle', ['CCNB1', 'CDK1']),
];

function Seed({ genes }: { genes: string[] }) {
  const { selectGenes } = useComparisonActions();
  React.useEffect(() => {
    if (genes.length > 0) selectGenes(genes, 'volcano');
  }, [genes, selectGenes]);
  return null;
}

function renderTable(selected: string[] = []) {
  return render(
    <ComparisonSelectionProvider>
      <Seed genes={selected} />
      <GOEnrichmentTable terms={TERMS} />
    </ComparisonSelectionProvider>
  );
}

describe('the overlap badge', () => {
  // With nothing selected the badge would say "0 / 4 selected" on every row — noise, not
  // information.
  it('says nothing at all when nothing is selected', () => {
    renderTable();
    expect(screen.queryByText(/selected$/)).toBeNull();
  });

  it('counts how much of each pathway is in the selection', () => {
    renderTable(['TP53', 'BAX']);

    expect(screen.getByText('2 / 4 selected')).toBeInTheDocument();
    // the other pathway shares nothing, and says so rather than hiding
    expect(screen.getByText('0 / 2 selected')).toBeInTheDocument();
  });

  it('matches genes regardless of case', () => {
    renderTable(['tp53', 'Bax']);
    expect(screen.getByText('2 / 4 selected')).toBeInTheDocument();
  });

  it('ignores a selected gene that is in no pathway', () => {
    renderTable(['TP53', 'NOT_A_PATHWAY_GENE']);
    expect(screen.getByText('1 / 4 selected')).toBeInTheDocument();
  });
});

describe('the focus button', () => {
  it('is absent when no caller wants to look through a pathway', () => {
    renderTable();
    expect(screen.queryByTitle(/Look through/)).toBeNull();
  });

  it('carries the whole term, genes included, so the caller need not look it up again', async () => {
    const onTermSelect = jest.fn();
    render(
      <ComparisonSelectionProvider>
        <GOEnrichmentTable terms={TERMS} onTermSelect={onTermSelect} />
      </ComparisonSelectionProvider>
    );

    const button = screen.getByTitle('Look through Apoptotic process');
    button.click();

    expect(onTermSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        go_id: 'GO:1',
        go_name: 'Apoptotic process',
        study_genes: ['TP53', 'MDM2', 'BAX', 'CASP3'],
      })
    );
  });
});
