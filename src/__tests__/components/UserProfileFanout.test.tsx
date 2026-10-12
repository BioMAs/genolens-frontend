/**
 * The comparison page must read `/users/me` ONCE, however many components
 * look at the profile.
 *
 * `AIInterpretationPanel`, `EnrichmentRadarPlot` and `AIChartAssistant` (one
 * per chart: volcano, PCA, UMAP...) each fetched it in their own `useEffect`,
 * outside React Query: one identical request per component, each logging its
 * own "Failed to fetch user profile" when the API struggled — as on 2026-10-12,
 * when the bookmark burst exhausted the database pool.
 *
 * Real components, real hooks and a real QueryClient; only HTTP is mocked.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/utils/api';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AIInterpretationPanel from '@/components/AIInterpretationPanel';
import EnrichmentRadarPlot from '@/components/EnrichmentRadarPlot';
import AIChartAssistant from '@/components/AIChartAssistant';

jest.mock('@/utils/api');
// Only called when the user starts an AI stream, never on mount.
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));

const mockApi = api as jest.Mocked<typeof api>;

const DATASET_ID = 'ds-1';
const COMPARISON = 'A_vs_B';

const TEAM_PROFILE = { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'TEAM' };
const STARTER_PROFILE = { id: 'u2', email: 'd@e.f', role: 'USER', subscription_plan: 'STARTER' };

const PATHWAYS = [
  { pathway_name: 'Cell cycle', category: 'KEGG', padj: 1e-6, gene_ratio: 0.2, regulation: 'ALL' },
  { pathway_name: 'DNA repair', category: 'KEGG', padj: 1e-4, gene_ratio: 0.1, regulation: 'ALL' },
];

/** Serves every GET the three components send on mount. */
function serveGets(profile: () => Promise<{ data: unknown }>) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/users/me') return profile();
    if (url === '/datasets/ai/status') {
      return Promise.resolve({ data: { available: true, current_model: 'gemma' } });
    }
    if (url.endsWith('/conversations')) return Promise.resolve({ data: { conversations: [] } });
    if (url.endsWith('/interpretation')) return Promise.resolve({ data: null });
    if (url.includes('/enrichment-pathways/')) return Promise.resolve({ data: PATHWAYS });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderComparisonReaders() {
  // `retryDelay: 0` keeps the hook's single retry from stalling the failure case.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AIInterpretationPanel datasetId={DATASET_ID} comparisonName={COMPARISON} />
        <EnrichmentRadarPlot datasetId={DATASET_ID} comparisonName={COMPARISON} />
        <AIChartAssistant datasetId={DATASET_ID} chartType="pca" contextKey="pca" context={{}} />
        <AIChartAssistant datasetId={DATASET_ID} chartType="umap" contextKey="umap" context={{}} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const profileCalls = () => mockApi.get.mock.calls.filter(([url]) => url === '/users/me');

describe('profile readers on the comparison page', () => {
  beforeAll(() => {
    // jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
    global.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads /users/me once for all of them, and unlocks AI for a TEAM plan', async () => {
    serveGets(() => Promise.resolve({ data: TEAM_PROFILE }));

    renderComparisonReaders();

    await waitFor(() => expect(screen.getAllByText('Ask AI')).toHaveLength(2));
    expect(await screen.findByText('Generate Interpretation')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /AI Select/ })).toBeEnabled();

    expect(profileCalls()).toHaveLength(1);
  });

  it('shows the upgrade gates to a plan without AI', async () => {
    serveGets(() => Promise.resolve({ data: STARTER_PROFILE }));

    renderComparisonReaders();

    await waitFor(() => expect(screen.getAllByText('AI Chart Assistant')).toHaveLength(2));
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument();
    expect(await screen.findByText('AI Biological Interpretation')).toBeInTheDocument();
    expect(screen.queryByText('Generate Interpretation')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /AI Select/ })).toBeDisabled();

    expect(profileCalls()).toHaveLength(1);
  });

  it('keeps the previous fallbacks when /users/me fails', async () => {
    serveGets(() => Promise.reject(new Error('500')));

    renderComparisonReaders();

    // The assistants settle on the gate, the radar locks AI, the panel stays hidden.
    await waitFor(() => expect(screen.getAllByText('AI Chart Assistant')).toHaveLength(2));
    expect(await screen.findByRole('button', { name: /AI Select/ })).toBeDisabled();
    expect(screen.queryByText('AI Biological Interpretation')).not.toBeInTheDocument();
  });
});
