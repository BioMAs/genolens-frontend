/**
 * The organism the interaction network asks STRING about, through the panel.
 *
 * The client can only guess it from gene names — title-case symbols read as mouse — while the
 * species the analysis was launched with lives on the server. The panel sends its dataset so the
 * server can substitute that species, and names the organism STRING was actually asked about.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// The cytoscape renderer is beside the point here, and does not run under jsdom.
jest.mock('next/dynamic', () => () => {
  const Graph = () => <div data-testid="ppi-graph" />;
  Graph.displayName = 'PPINetworkGraph';
  return Graph;
});

import PPINetworkSection from '@/components/network/PPINetworkSection';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';
import type { Dataset } from '@/types';

/** A DEG dataset from a rat analysis: its metadata points at the analysis, not at a species. */
const DEG = {
  id: 'deg-rat',
  project_id: 'p1',
  dataset_metadata: { analysis_id: 'analysis-1' },
} as unknown as Dataset;

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true,
});

// Rodent nomenclature: on its own, the client takes these for mouse.
const CLOUD = [point('Trp53', 2.4, 1e-8), point('Cdkn1a', -1.9, 1e-6), point('Mdm2', 1.7, 1e-5)];
const MOUSE = 10090;

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <PPINetworkSection dataset={DEG} comparisonName="Treated_vs_Control" />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

const networkCall = () =>
  mockApi.post.mock.calls.find(([url]) => url === '/integrations/string/network');

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: { points: CLOUD, total_genes: 3, significant_genes: 3, cached: true },
  });
});

it('sends its dataset, with the guess only as the fallback', async () => {
  mockApi.post.mockReturnValue(new Promise(() => {}));
  renderPanel();

  await waitFor(() => expect(networkCall()).toBeDefined());
  expect(networkCall()![1]).toEqual(
    expect.objectContaining({ dataset_id: 'deg-rat', species: MOUSE })
  );
});

it('names the organism the server asked STRING about, not the guess', async () => {
  mockApi.post.mockResolvedValue({
    data: {
      nodes: [
        { id: 'Trp53', name: 'Trp53' },
        { id: 'Mdm2', name: 'Mdm2' },
      ],
      edges: [{ source: 'Trp53', target: 'Mdm2', score: 0.99 }],
      species: 10116,
      species_source: 'dataset',
      count: 1,
    },
  });
  renderPanel();

  expect(await screen.findByText(/STRING, rat/)).toBeInTheDocument();
  expect(screen.queryByText(/mouse/)).toBeNull();
});

it('does not name the guess while STRING has not answered', async () => {
  mockApi.post.mockReturnValue(new Promise(() => {}));
  renderPanel();

  await waitFor(() => expect(networkCall()).toBeDefined());
  expect(screen.getByText(/· STRING$/)).toBeInTheDocument();
  expect(screen.queryByText(/mouse/)).toBeNull();
});

it('says the organism is the analysis’s when STRING knows none of the genes', async () => {
  mockApi.post.mockResolvedValue({
    data: {
      nodes: [],
      edges: [],
      species: 7955,
      species_source: 'dataset',
      count: 0,
      error: 'not_found',
    },
  });
  renderPanel();

  expect(
    await screen.findByText(
      /none of these 3 genes as zebrafish proteins — the species this analysis was launched with/
    )
  ).toBeInTheDocument();
});

it('says the organism was inferred when the dataset records none', async () => {
  mockApi.post.mockResolvedValue({
    data: {
      nodes: [],
      edges: [],
      species: MOUSE,
      species_source: 'request',
      count: 0,
      error: 'not_found',
    },
  });
  renderPanel();

  expect(
    await screen.findByText(/as mouse proteins — the organism is inferred from the gene identifiers/)
  ).toBeInTheDocument();
});
