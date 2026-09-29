/**
 * The over-representation panel on the Understand screen filters stored results — it never
 * re-runs the enrichment.
 *
 * The terms are computed once, during the analysis, and read back from the database. The panel
 * used to offer a log FC threshold, an enrichment p-value, min/max term size, an adjusted p-value
 * threshold and a "true path rule" toggle, and all of them were held in state that nothing read:
 * typing a value changed nothing, while users believed they were recomputing. What is pinned
 * here is that every control left on screen changes the rows handed to the views, and that the
 * ones which would need a recomputation are gone.
 *
 * The views themselves are stubbed: the table to a list of term names, which is exactly what the
 * filters decide; the charts, the tree and the radar because they fetch or draw on their own.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatasetStatus, DatasetType, type Dataset } from '@/types';
import GOEnrichmentAnalysis from '@/components/GOEnrichmentAnalysis';
import api from '@/utils/api';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('@/utils/api');

jest.mock('@/contexts/ComparisonSelectionContext', () => ({
  useComparisonActions: () => ({ focusTerm: jest.fn() }),
}));

jest.mock('@/components/GOEnrichmentTable', () => {
  const Stub = ({ terms }: { terms: Array<{ go_id: string; go_name: string }> }) => (
    <ul data-testid="enrichment-rows">
      {terms.map((t) => (
        <li key={t.go_id}>{t.go_name}</li>
      ))}
    </ul>
  );
  Stub.displayName = 'GOEnrichmentTable';
  return Stub;
});
jest.mock('@/components/EnrichmentHistogram', () => () => null);
jest.mock('@/components/GOTreePanel', () => () => null);
jest.mock('next/dynamic', () => () => () => null);

const mockGet = api.get as jest.Mock;

// bg_ratio is "n/N": n, the genes annotated to the term, is the term size.
const PATHWAYS = [
  { pathway_id: 'GO:1', pathway_name: 'Tiny term', category: 'GO:BP', padj: 0.001, gene_count: 3, bg_ratio: '4/20000', regulation: 'ALL' },
  { pathway_id: 'GO:2', pathway_name: 'Mid term', category: 'GO:BP', padj: 0.02, gene_count: 10, bg_ratio: '120/20000', regulation: 'ALL' },
  { pathway_id: 'GO:3', pathway_name: 'Huge term', category: 'GO:BP', padj: 0.04, gene_count: 40, bg_ratio: '900/20000', regulation: 'ALL' },
  { pathway_id: 'GO:4', pathway_name: 'Up-only term', category: 'GO:BP', padj: 0.01, gene_count: 5, bg_ratio: '80/20000', regulation: 'UP' },
];

function dataset(metadata: Record<string, unknown> = {}): Dataset {
  return {
    id: 'deg-1',
    project_id: 'p-1',
    name: 'A_vs_B',
    type: DatasetType.DEG,
    status: DatasetStatus.READY,
    dataset_metadata: metadata,
  } as unknown as Dataset;
}

function mockApi(analysisParams?: { fdr: number; min_log2fc: number }) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/enrichment-pathways/')) return Promise.resolve({ data: { pathways: PATHWAYS } });
    if (url.includes('/deg-genes/')) return Promise.resolve({ data: { genes: [], pagination: { total_pages: 1 } } });
    if (url.startsWith('/analyses/') && analysisParams) {
      return Promise.resolve({ data: { id: 'an-1', status: 'COMPLETED', params: analysisParams } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

async function renderPanel(ds: Dataset = dataset()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <GOEnrichmentAnalysis dataset={ds} comparisonName="A_vs_B" />
      </ThemeProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByRole('button', { name: 'Table' }));
  await user.click(screen.getByRole('button', { name: /filter/i }));
  return user;
}

const rows = () => within(screen.getByTestId('enrichment-rows')).getAllByRole('listitem').map((li) => li.textContent);

beforeEach(() => {
  mockGet.mockReset();
  mockApi();
});

describe('what "All DEGs" shows', () => {
  // The three enrichments (all / up / down) used to be listed together, a term up to three times.
  it('is the enrichment on all DEGs, not the union with the up and down sets', async () => {
    await renderPanel();
    expect(rows()).toEqual(['Tiny term', 'Mid term', 'Huge term']);
  });
});

describe('the controls that remain filter the stored rows', () => {
  it('adj. p-value cut-off hides terms above it', async () => {
    const user = await renderPanel();
    await user.type(screen.getByLabelText(/adj\. p-value/i), '0.01');
    expect(rows()).toEqual(['Tiny term']);
  });

  it('min term size hides terms annotated to fewer genes', async () => {
    const user = await renderPanel();
    await user.type(screen.getByLabelText(/min term size/i), '5');
    expect(rows()).toEqual(['Mid term', 'Huge term']);
  });

  it('max term size hides terms annotated to more genes', async () => {
    const user = await renderPanel();
    await user.type(screen.getByLabelText(/max term size/i), '500');
    expect(rows()).toEqual(['Tiny term', 'Mid term']);
  });

  it('clearing a bound shows the terms again', async () => {
    const user = await renderPanel();
    const input = screen.getByLabelText(/max term size/i);
    await user.type(input, '500');
    await user.clear(input);
    expect(rows()).toEqual(['Tiny term', 'Mid term', 'Huge term']);
  });
});

describe('the controls that would need a recomputation are gone', () => {
  it.each([
    /log ?fc threshold/i,
    /enrichment p-value/i,
    /propagate annotations/i,
    /true path/i,
    /advanced options/i,
  ])('%s', async (name) => {
    const user = await renderPanel();
    // They used to sit behind a collapsed toggle: open it if it is there, or the check is empty.
    const advanced = screen.queryByRole('button', { name: /advanced options/i });
    if (advanced) await user.click(advanced);
    expect(screen.queryByText(name)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(name)).not.toBeInTheDocument();
  });

  it('leaves exactly the three numeric filters', async () => {
    await renderPanel();
    expect(screen.getAllByRole('spinbutton').map((el) => el.id)).toEqual([
      'enrichment-max-padj',
      'enrichment-min-term-size',
      'enrichment-max-term-size',
    ]);
  });
});

describe('the line saying how the enrichment was computed', () => {
  it('quotes the thresholds of the analysis that produced it', async () => {
    mockApi({ fdr: 0.05, min_log2fc: 1 });
    await renderPanel(dataset({ analysis_id: 'an-1' }));
    await waitFor(() =>
      expect(screen.getByText(/computed during the analysis on DEGs at FDR 0\.05 and \|log2FC\| ≥ 1\b/)).toBeInTheDocument()
    );
    expect(screen.getByText(/do not re-run it/)).toBeInTheDocument();
  });

  // The wizard lets both thresholds be changed; a hard-coded "0.05 / 1" would then be false.
  it('follows thresholds changed in the wizard', async () => {
    mockApi({ fdr: 0.01, min_log2fc: 0.58 });
    await renderPanel(dataset({ analysis_id: 'an-1' }));
    expect(await screen.findByText(/FDR 0\.01 and \|log2FC\| ≥ 0\.58/)).toBeInTheDocument();
  });

  // The wizard's default fold change is 1.5, so most analyses were enriched at 0.58, not 1.
  it('shows the wizard default fold change as a readable log2FC', async () => {
    mockApi({ fdr: 0.05, min_log2fc: Math.log2(1.5) });
    await renderPanel(dataset({ analysis_id: 'an-1' }));
    expect(await screen.findByText(/FDR 0\.05 and \|log2FC\| ≥ 0\.58\./)).toBeInTheDocument();
  });

  it('claims no thresholds when there is no analysis to read them from', async () => {
    await renderPanel();
    expect(screen.getByText(/do not re-run it/)).toBeInTheDocument();
    expect(screen.queryByText(/FDR \d/)).not.toBeInTheDocument();
  });
});
