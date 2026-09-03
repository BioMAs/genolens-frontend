/**
 * The heatmap as the payoff of a selection.
 *
 * Two things worth pinning. It must mount **nothing** until opened — it is the heaviest panel
 * on the screen and would otherwise build a second Plotly canvas next to the volcano's for
 * anyone who merely arrived. And the selection mode must be honest about the genes it cannot
 * draw, since a selected gene absent from the plotted points has no values.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

/** Stands in for the clustering view, and reports whether it was handed an override. */
jest.mock('@/components/analysis/DEGClusteringView', () => {
  const Stub = ({ genesOverride }: { genesOverride?: Array<{ gene_id: string }> }) => (
    <div
      data-testid="clustering-view"
      data-override={genesOverride ? genesOverride.map((g) => g.gene_id).join(',') : ''}
    >
      clustering
    </div>
  );
  Stub.displayName = 'DEGClusteringView';
  return { __esModule: true, default: Stub };
});

import HeatmapSection from '@/components/comparison/explorer/HeatmapSection';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';
import type { Dataset } from '@/types';

const DEG = { id: 'deg-1', project_id: 'p1' } as Dataset;
const MATRIX = { id: 'mx-1', project_id: 'p1' } as Dataset;
const COMPARISON = 'Treated_vs_Control';

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true,
});

const CLOUD = [
  point('TP53', 2.4, 1e-8),
  point('MDM2', -1.9, 1e-6),
  point('QUIET', 0.1, 0.7),
];

function Seed({ genes }: { genes: string[] }) {
  const { selectGenes } = useComparisonActions();
  React.useEffect(() => {
    if (genes.length > 0) selectGenes(genes, 'volcano', 'Lasso');
  }, [genes, selectGenes]);
  return null;
}

function renderSection(selected: string[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <Seed genes={selected} />
        <HeatmapSection
          degDataset={DEG}
          matrixDataset={MATRIX}
          comparisonName={COMPARISON}
        />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

const open = () => userEvent.click(screen.getByText(/Heatmap & clustering/));

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: { points: CLOUD, total_genes: 3, significant_genes: 2, cached: true },
  });
});

describe('cost', () => {
  // The whole reason it is collapsed: never build Plotly for a panel nobody asked for.
  it('mounts nothing until it is opened', () => {
    renderSection();
    expect(screen.queryByTestId('clustering-view')).toBeNull();
  });

  it('mounts on the first open', async () => {
    renderSection();
    await open();
    expect(await screen.findByTestId('clustering-view')).toBeInTheDocument();
  });
});

describe('the two modes', () => {
  it('starts on the top DEGs, with no override', async () => {
    renderSection();
    await open();

    const view = await screen.findByTestId('clustering-view');
    expect(view.dataset.override).toBe('');
  });

  it('refuses the selection mode when nothing is selected', async () => {
    renderSection();
    await open();

    expect(screen.getByRole('button', { name: 'Current selection' })).toBeDisabled();
  });

  it('hands the selected genes down as an override', async () => {
    renderSection(['TP53', 'MDM2']);
    await open();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Current selection' })).toBeEnabled()
    );

    await userEvent.click(screen.getByRole('button', { name: 'Current selection' }));

    await waitFor(() =>
      expect(screen.getByTestId('clustering-view').dataset.override).toBe('TP53,MDM2')
    );
  });

  // A selected gene absent from the plotted points has no values to draw, and a gene below the
  // thresholds is drawn but is not a DEG. Both are stated rather than quietly dropped.
  it('says how many selected genes it cannot account for', async () => {
    renderSection(['TP53', 'QUIET', 'NOT_PLOTTED']);
    await open();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Current selection' })).toBeEnabled()
    );

    await userEvent.click(screen.getByRole('button', { name: 'Current selection' }));

    expect(await screen.findByText(/1 not significant at these thresholds/)).toBeInTheDocument();
    expect(screen.getByText(/1 without values here/)).toBeInTheDocument();
  });
});

describe('the closed summary', () => {
  it('mentions the selection, so the payoff is discoverable while collapsed', async () => {
    renderSection(['TP53', 'MDM2']);
    expect(await screen.findByText(/2 genes selected/)).toBeInTheDocument();
  });
});
