/**
 * The page's single DEG definition.
 *
 * The bug this hook exists to close: the results page carried two counts that disagreed — the
 * header read numbers frozen at ingestion (the upstream pipeline's `contrast:` labels, which
 * never had padj/log2FC applied to them at all), while the overview recounted the volcano cloud
 * at the live thresholds. Same caption, different numbers, and only one of them moved when you
 * touched the threshold control.
 *
 * So the tests that matter here are about *sharing*: two callers must agree with each other, must
 * both react to a threshold change, and must cost one request between them rather than two.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useSignificanceSummary } from '@/hooks/useSignificanceSummary';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  // The server's flag reflects whatever thresholds the request carried; it must be ignored.
  is_significant: true,
});

/**
 * At padj < 0.05 / |lfc| > 0.58 → 2 up, 1 down, 3 ns.
 * At padj < 0.001              → 1 up, 1 down, 4 ns.
 */
const CLOUD = [
  point('UP_STRONG', 3.2, 1e-9),
  point('UP_WEAK', 1.4, 0.01),
  point('DOWN_STRONG', -2.7, 1e-8),
  point('NS_BY_PADJ', 4.0, 0.2),
  point('NS_BY_LFC', 0.2, 1e-9),
  point('ON_BOUNDARY', 0.58, 0.05),
];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>{children}</ComparisonSelectionProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: {
      dataset_id: 'ds-1',
      comparison_name: 'Treated_vs_Control',
      points: CLOUD,
      total_genes: CLOUD.length,
      significant_genes: 99, // deliberately wrong — must be ignored
      cached: true,
    },
  });
});

describe('counts', () => {
  it('derives up/down/ns from the cloud at the default thresholds', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSignificanceSummary('ds-1', 'Treated_vs_Control'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(result.current.summary).toMatchObject({ up: 2, down: 1, ns: 3, significant: 3 });
  });

  it('ignores the server verdict in significant_genes', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSignificanceSummary('ds-1', 'Treated_vs_Control'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(result.current.summary!.significant).not.toBe(99);
  });

  it('reports null rather than zeroes before the cloud arrives', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSignificanceSummary('ds-1', 'Treated_vs_Control'),
      { wrapper }
    );

    // A premature { up: 0, down: 0 } would render "No gene passes the thresholds" on arrival.
    expect(result.current.summary).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('makes no request when disabled', () => {
    const { wrapper } = makeWrapper();
    renderHook(
      () => useSignificanceSummary('ds-1', 'Treated_vs_Control', false),
      { wrapper }
    );
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('two callers', () => {
  it('agree on the same numbers', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        header: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
        overview: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.header.summary).not.toBeNull());
    // The regression: 1,185 up in one place and 1,195 up in the other.
    expect(result.current.header.summary).toEqual(result.current.overview.summary);
  });

  it('cost one request between them, not two', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        header: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
        overview: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.header.summary).not.toBeNull());
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('both follow a threshold change, without refetching', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        header: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
        overview: useSignificanceSummary('ds-1', 'Treated_vs_Control'),
        actions: useComparisonActions(),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.header.summary).not.toBeNull());
    expect(result.current.header.summary!.up).toBe(2);

    act(() => {
      result.current.actions.setThresholds({ padj: 0.001, logfc: 0.58 });
    });

    await waitFor(() => expect(result.current.header.summary!.up).toBe(1));
    // Header and overview must move together — the old header moved not at all.
    expect(result.current.overview.summary).toEqual(result.current.header.summary);
    expect(result.current.header.summary).toMatchObject({ up: 1, down: 1, ns: 4 });
    // Thresholds are absent from the query key, so tightening is pure recomputation.
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });
});
