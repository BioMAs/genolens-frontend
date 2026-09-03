/**
 * What a lassoed set can be turned into.
 *
 * Every action here runs on an endpoint that already existed — gene lists, batch bookmarks, the
 * export menu — so the tests are about the payloads and the reporting, not about new plumbing.
 * The point worth pinning is that a set the user just drew becomes something they can keep.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@/components/ExportMenu', () => {
  const Stub = ({ data }: { data: Record<string, unknown>[] }) => (
    <div data-testid="export-menu" data-rows={JSON.stringify(data)}>
      Export
    </div>
  );
  Stub.displayName = 'ExportMenu';
  return { __esModule: true, default: Stub };
});

import MultiSelectionCard from '@/components/comparison/explorer/MultiSelectionCard';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';
import type { Dataset } from '@/types';

const DATASET = { id: 'ds-1', project_id: 'proj-1' } as Dataset;
const COMPARISON = 'Treated_vs_Control';

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true,
});

const CLOUD = [
  point('UP_STRONG', 4.2, 1e-12),
  point('UP_WEAK', 0.9, 0.02),
  point('DOWN_GENE', -3.1, 1e-9),
  point('NS_GENE', 0.1, 0.6),
];

const SELECTED = ['UP_STRONG', 'UP_WEAK', 'DOWN_GENE', 'NS_GENE', 'ABSENT_GENE'];

/** Applies the selection once mounted, the way a lasso would. */
function Seed({ genes, label }: { genes: string[]; label?: string }) {
  const { selectGenes } = useComparisonActions();
  React.useEffect(() => {
    selectGenes(genes, 'volcano', label);
  }, [genes, label, selectGenes]);
  return null;
}

function renderCard(genes = SELECTED, label = 'Lasso · 5 genes') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <Seed genes={genes} label={label} />
        <MultiSelectionCard dataset={DATASET} comparisonName={COMPARISON} />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: {
      dataset_id: DATASET.id,
      comparison_name: COMPARISON,
      points: CLOUD,
      total_genes: CLOUD.length,
      significant_genes: 3,
      cached: true,
    },
  });
  mockApi.post.mockResolvedValue({
    data: { id: 'gl-1', name: 'My set', project_id: DATASET.project_id, genes: SELECTED },
  });
});

describe('describing the set', () => {
  it('counts the selection and echoes where it came from', async () => {
    renderCard();

    expect(await screen.findByText('5 genes selected')).toBeInTheDocument();
    expect(screen.getByText('Lasso · 5 genes')).toBeInTheDocument();
  });

  it('splits up and down, and says how many have no verdict here', async () => {
    renderCard();
    await screen.findByText('Strongest fold change');

    expect(screen.getByText('2')).toBeInTheDocument(); // up
    expect(screen.getByText('1')).toBeInTheDocument(); // down
    // NS_GENE is not significant, ABSENT_GENE is not in the cloud at all
    expect(screen.getByText(/2 without a verdict here/)).toBeInTheDocument();
  });

  it('ranks the strongest fold changes and the most significant genes', async () => {
    renderCard();

    expect(await screen.findByText('Strongest fold change')).toBeInTheDocument();
    expect(screen.getByText('Most significant')).toBeInTheDocument();
    // a gene absent from the cloud can be ranked by neither
    expect(screen.queryByTitle('Show ABSENT_GENE')).toBeNull();
  });
});

describe('saving as a gene list', () => {
  it('sends the whole selection in one call', async () => {
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.type(screen.getByLabelText('Gene list name'), 'Wnt hits');
    await userEvent.click(screen.getByRole('button', { name: /Save list/ }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        `/projects/${DATASET.project_id}/gene-lists`,
        expect.objectContaining({ name: 'Wnt hits', genes: SELECTED })
      )
    );
  });

  it('falls back to the selection label when no name is typed', async () => {
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.click(screen.getByRole('button', { name: /Save list/ }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        expect.stringContaining('gene-lists'),
        expect.objectContaining({ name: 'Lasso · 5 genes' })
      )
    );
  });

  it('confirms with the name the server actually stored', async () => {
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.click(screen.getByRole('button', { name: /Save list/ }));

    expect(await screen.findByText(/Saved as/)).toHaveTextContent('My set');
  });

  it('says so when the save fails, rather than looking successful', async () => {
    mockApi.post.mockRejectedValue(new Error('boom'));
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.click(screen.getByRole('button', { name: /Save list/ }));

    expect(await screen.findByText(/Could not save the list/)).toBeInTheDocument();
  });
});

describe('bookmarking the set', () => {
  it('posts the symbols to the batch endpoint', async () => {
    mockApi.post.mockResolvedValue({ data: { created: 5, skipped: 0, bookmarks: [] } });
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.click(screen.getByRole('button', { name: /Bookmark all/ }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        `/projects/${DATASET.project_id}/bookmarks/batch`,
        { gene_symbols: SELECTED }
      )
    );
  });

  it('reports how many were new and how many were already there', async () => {
    mockApi.post.mockResolvedValue({ data: { created: 3, skipped: 2, bookmarks: [] } });
    renderCard();
    await screen.findByText('5 genes selected');

    await userEvent.click(screen.getByRole('button', { name: /Bookmark all/ }));

    expect(await screen.findByText(/3 bookmarked, 2 already there/)).toBeInTheDocument();
  });
});

describe('exporting the set', () => {
  it('hands the export menu one row per selected gene, blank where unknown', async () => {
    renderCard();
    await screen.findByText('Strongest fold change');

    const rows = JSON.parse(screen.getByTestId('export-menu').dataset.rows ?? '[]');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      gene: 'UP_STRONG',
      log2_fold_change: '4.200',
      adjusted_p_value: '1.00e-12',
      regulation: 'UP',
    });
    // absent from the cloud: named, but with nothing invented for it
    expect(rows[4]).toEqual({
      gene: 'ABSENT_GENE',
      log2_fold_change: '',
      adjusted_p_value: '',
      regulation: '',
    });
  });
});
