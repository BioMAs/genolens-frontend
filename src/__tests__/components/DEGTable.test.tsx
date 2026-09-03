/**
 * Regression tests for the DEG table's data layer.
 *
 * Two bugs are pinned here, both live before the shared-threshold work:
 *
 * 1. The table owned a private padj/log2FC pair, independent of the volcano's, in the same pane.
 *    The first test asserts the table renders **no** threshold control at all — the one control
 *    lives in the synthesis strip, and a second one reappearing is the regression to catch.
 * 2. The table fetched one 1000-row page and then filtered, sorted and paginated in memory,
 *    truncating silently and counting "Showing X of Y" over the truncated set. The remaining
 *    tests assert every one of those now travels to the server.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import DEGTable from '@/components/DEGTable';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
  type SelectionSource,
} from '@/contexts/ComparisonSelectionContext';
import type { Dataset } from '@/types';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

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

const DATASET = { id: 'ds-1', project_id: 'proj-1' } as Dataset;
const COMPARISON = 'Treated_vs_Control';

const row = (i: number) => ({
  gene_id: `ENSG${String(i).padStart(11, '0')}`,
  gene_name: `GENE${i}`,
  log_fc: i % 2 === 0 ? 2.5 : -1.8,
  padj: 1e-6,
  regulation: i % 2 === 0 ? 'UP' : 'DOWN',
  pvalue: 1e-7,
  base_mean: 120,
});

/** `total` is deliberately far above one page — that excess is what used to vanish. */
function degResponse(total = 4321, page = 1, pageSize = 25) {
  return {
    data: {
      genes: Array.from({ length: Math.min(pageSize, total) }, (_, i) => row(i + 1)),
      total_up: 2600,
      total_down: 1721,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    },
  };
}

/** Applies a selection made somewhere other than the table, the way a lasso would. */
function Seed({ genes, source }: { genes: string[]; source: SelectionSource }) {
  const { selectGenes } = useComparisonActions();
  React.useEffect(() => {
    selectGenes(genes, source, 'Lasso');
  }, [genes, source, selectGenes]);
  return null;
}

function renderTable(seed?: { genes: string[]; source: SelectionSource }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        {seed ? <Seed genes={seed.genes} source={seed.source} /> : null}
        <DEGTable dataset={DATASET} comparisonName={COMPARISON} />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

/**
 * Query params of the most recent request for the visible page.
 *
 * Two queries run per render — the visible page, and a 1000-row one feeding the export menu —
 * so the export's page size identifies and excludes it. Reading the *last* match matters:
 * after a click, page 1's request is still the earliest entry in the call list.
 */
function visiblePageParams(): Record<string, unknown> {
  const calls = mockApi.get.mock.calls.filter(
    ([, config]) =>
      (config as { params?: { page_size?: number } } | undefined)?.params?.page_size !== 1000
  );
  const last = calls[calls.length - 1];
  return (last?.[1] as { params: Record<string, unknown> }).params;
}

/** Resolves once the table body is on screen, not merely requested. */
const tableRendered = () => screen.findByRole('button', { name: /Columns/ });

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue(degResponse());
});

describe('threshold ownership', () => {
  // The bug: two independent threshold pairs in one pane, plus a third value hard-coded as text
  // in the header. The table must no longer offer one.
  it('renders no threshold control of its own', async () => {
    renderTable();
    await tableRendered();

    expect(screen.queryByLabelText(/p-?adj/i)).toBeNull();
    expect(screen.queryByLabelText(/log2fc|fold change/i)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('sends the shared thresholds to the server as SQL filters', async () => {
    renderTable();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    expect(visiblePageParams()).toMatchObject({ padj_max: 0.05, logfc_min: 0.58 });
  });
});

describe('server-side paging', () => {
  it('reports the server total, not the size of one page', async () => {
    renderTable();

    // 4321 rows in 25-row pages — the in-memory version could never see past 1000.
    expect(await screen.findByText('Showing 1 to 25 of 4,321 genes')).toBeInTheDocument();
    expect(screen.getByText('4,321 genes at the current thresholds')).toBeInTheDocument();
  });

  it('formats counts with an explicit locale so the server and client agree', async () => {
    renderTable();
    // The comma is the assertion: a bare toLocaleString() renders differently per runtime
    // locale, which broke hydration before.
    expect(await screen.findByText('4,321 genes at the current thresholds')).toBeInTheDocument();
  });

  it('asks the server for the next page instead of slicing in memory', async () => {
    renderTable();
    await screen.findByText(/Showing 1 to 25/);

    mockApi.get.mockResolvedValue(degResponse(4321, 2));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(visiblePageParams()).toMatchObject({ page: 2 }));
  });

  it('pushes the regulation filter to the server, so it composes with pagination', async () => {
    renderTable();
    await tableRendered();

    await userEvent.selectOptions(screen.getByLabelText('Regulation filter'), 'up');

    await waitFor(() => expect(visiblePageParams()).toMatchObject({ regulation: 'UP' }));
  });

  it('sends the server column name when a sortable header is clicked', async () => {
    renderTable();
    await tableRendered();

    await userEvent.click(screen.getByText('Log2FC'));

    // log2FC reads best largest-first, unlike padj
    await waitFor(() =>
      expect(visiblePageParams()).toMatchObject({ sort_by: 'log_fc', sort_order: 'desc' })
    );
  });

  it('keeps padj ascending, and sends no regulation filter, by default', async () => {
    renderTable();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    expect(visiblePageParams()).toMatchObject({ sort_by: 'padj', sort_order: 'asc' });
    expect(visiblePageParams()).not.toHaveProperty('regulation');
  });
});

describe('empty and error states', () => {
  it('says plainly when no gene passes the thresholds', async () => {
    mockApi.get.mockResolvedValue(degResponse(0));
    renderTable();

    await waitFor(() =>
      expect(screen.getByText(/No gene passes these thresholds/i)).toBeInTheDocument()
    );
  });

  it('reports a failure instead of rendering an empty table', async () => {
    mockApi.get.mockRejectedValue(new Error('boom'));
    renderTable();

    await waitFor(() =>
      expect(screen.getByText(/Failed to load the gene table/i)).toBeInTheDocument()
    );
  });
});

describe('rows drive the shared selection', () => {
  it('marks the clicked row as selected', async () => {
    renderTable();
    await tableRendered();

    const row = screen.getByText('GENE1').closest('tr')!;
    expect(row).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(row);

    await waitFor(() => expect(row).toHaveAttribute('aria-selected', 'true'));
  });

  it('replaces the selection on a plain click', async () => {
    renderTable();
    await tableRendered();

    const first = screen.getByText('GENE1').closest('tr')!;
    const second = screen.getByText('GENE2').closest('tr')!;

    await userEvent.click(first);
    await userEvent.click(second);

    await waitFor(() => expect(second).toHaveAttribute('aria-selected', 'true'));
    expect(first).toHaveAttribute('aria-selected', 'false');
  });

  it('adds to the selection on a shift-click, matching the volcano gesture', async () => {
    renderTable();
    await tableRendered();

    const first = screen.getByText('GENE1').closest('tr')!;
    const second = screen.getByText('GENE2').closest('tr')!;

    await userEvent.click(first);
    fireEvent.click(second, { shiftKey: true });

    await waitFor(() => expect(second).toHaveAttribute('aria-selected', 'true'));
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  // Starring a gene and selecting it are different intents; the row must not swallow both.
  it('does not select the row when the bookmark button is clicked', async () => {
    renderTable();
    await tableRendered();

    const row = screen.getByText('GENE1').closest('tr')!;
    await userEvent.click(row.querySelector('button')!);

    expect(row).toHaveAttribute('aria-selected', 'false');
  });
});

describe('the table follows a selection made elsewhere', () => {
  const IN_TABLE = ['ENSG00000000001', 'ENSG00000000003'];

  it('narrows to the selected genes', async () => {
    renderTable({ genes: IN_TABLE, source: 'volcano' });

    expect(await screen.findByText(/Showing the 2 selected genes/)).toBeInTheDocument();
    expect(screen.getByText('GENE1')).toBeInTheDocument();
    expect(screen.getByText('GENE3')).toBeInTheDocument();
    expect(screen.queryByText('GENE2')).toBeNull();
  });

  // deg_genes only holds genes that were already significant at ingestion, so a volcano point
  // outside that set has statistics on the plot and none here. Saying so beats hiding it.
  it('counts the selected genes that have no row, rather than dropping them silently', async () => {
    renderTable({ genes: [...IN_TABLE, 'NOT_INGESTED'], source: 'volcano' });

    expect(await screen.findByText(/1 selected gene has no row at these thresholds/)).toBeInTheDocument();
  });

  it('says so when none of the selection has a row', async () => {
    renderTable({ genes: ['NOT_INGESTED'], source: 'volcano' });

    expect(
      await screen.findByText(/None of the selected genes has a row at these thresholds/)
    ).toBeInTheDocument();
  });

  // The trap this avoids: collapsing to the row the user just clicked would leave them unable
  // to click a different one without clearing the selection first.
  it('does NOT narrow to a selection the table itself made', async () => {
    renderTable();
    await tableRendered();

    await userEvent.click(screen.getByText('GENE1').closest('tr')!);

    await waitFor(() =>
      expect(screen.getByText('GENE1').closest('tr')!).toHaveAttribute('aria-selected', 'true')
    );
    // every other row is still there to be clicked
    expect(screen.getByText('GENE2')).toBeInTheDocument();
    expect(screen.queryByText(/Showing the 1 selected gene/)).toBeNull();
  });
});
