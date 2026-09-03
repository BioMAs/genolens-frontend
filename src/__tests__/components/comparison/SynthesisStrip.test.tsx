/**
 * The synthesis strip, and the invariant the whole Explorer design rests on.
 *
 * `GET /volcano-plot` does not filter by threshold: on the cached path it returns the entire
 * stored cloud and recomputes only a boolean (`datasets.py:2014-2044`). So `useVolcanoPoints`
 * keeps thresholds out of its query key and significance is derived in memory. The test that
 * matters here is the request count: tightening a threshold must issue **zero** new requests
 * while the numbers on screen still change.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import SynthesisStrip from '@/components/comparison/explorer/SynthesisStrip';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  // Deliberately wrong: the server's flag reflects whatever thresholds the request carried, and
  // the component must ignore it in favour of its own computation.
  is_significant: true,
});

/**
 * Six points chosen so a single tightening step moves the counts:
 * at padj < 0.05 / |lfc| > 0.58 → 2 up, 1 down, 3 not significant.
 * at padj < 0.001               → 1 up, 1 down, 4 not significant.
 */
const CLOUD = [
  point('UP_STRONG', 3.2, 1e-9),
  point('UP_WEAK', 1.4, 0.01),
  point('DOWN_STRONG', -2.7, 1e-8),
  point('NS_BY_PADJ', 4.0, 0.2),
  point('NS_BY_LFC', 0.2, 1e-9),
  point('ON_BOUNDARY', 0.58, 0.05),
];

function renderStrip() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <SynthesisStrip datasetId="ds-1" comparisonName="Treated_vs_Control" />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: {
      dataset_id: 'ds-1',
      comparison_name: 'Treated_vs_Control',
      points: CLOUD,
      total_genes: CLOUD.length,
      significant_genes: 99, // also deliberately wrong — must be ignored
      cached: true,
    },
  });
});

describe('counts', () => {
  it('counts up and down from the cloud at the current thresholds', async () => {
    renderStrip();

    expect(await screen.findByText('2')).toBeInTheDocument(); // up
    expect(screen.getByText('1')).toBeInTheDocument(); // down
    expect(screen.getByText('3 not significant')).toBeInTheDocument();
  });

  it("ignores the server's significant_genes, which answers a different question", async () => {
    renderStrip();
    await screen.findByText('2');

    expect(screen.queryByText('99')).toBeNull();
  });

  // Both server comparisons are strict, so a point sitting exactly on a threshold is out.
  it('excludes a point sitting exactly on both thresholds', async () => {
    renderStrip();
    await screen.findByText('2');

    // ON_BOUNDARY is among the three non-significant points, not the two up
    expect(screen.getByText('3 not significant')).toBeInTheDocument();
  });
});

describe('tightening a threshold', () => {
  it('recounts without issuing a single new request', async () => {
    renderStrip();
    await screen.findByText('2');

    const callsBefore = mockApi.get.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    await userEvent.selectOptions(
      screen.getByLabelText('Adjusted p-value threshold'),
      '0.001'
    );

    // UP_WEAK (padj 0.01) drops out; UP_STRONG and DOWN_STRONG remain
    await waitFor(() => expect(screen.getByText('4 not significant')).toBeInTheDocument());

    // The whole point: the cloud was never refetched.
    expect(mockApi.get.mock.calls.length).toBe(callsBefore);
  });

  it('requests the cloud at the ingestion defaults, whatever the UI shows', async () => {
    renderStrip();
    await screen.findByText('2');

    await userEvent.selectOptions(
      screen.getByLabelText('Absolute log2 fold change threshold'),
      '2'
    );
    await waitFor(() => expect(screen.getByText('4 not significant')).toBeInTheDocument());

    for (const [, config] of mockApi.get.mock.calls) {
      expect((config as { params: Record<string, number> }).params).toMatchObject({
        padj_threshold: 0.05,
        logfc_threshold: 0.58,
      });
    }
  });
});

describe('control bounds', () => {
  it('offers no threshold looser than what ingestion kept', async () => {
    renderStrip();
    await screen.findByText('2');

    const padj = screen.getByLabelText('Adjusted p-value threshold') as HTMLSelectElement;
    const values = Array.from(padj.options).map((o) => Number(o.value));
    expect(Math.max(...values)).toBe(0.05);

    const logfc = screen.getByLabelText(
      'Absolute log2 fold change threshold'
    ) as HTMLSelectElement;
    const lfcValues = Array.from(logfc.options).map((o) => Number(o.value));
    expect(Math.min(...lfcValues)).toBe(0.58);
  });

  it('exposes exactly one control per threshold', async () => {
    renderStrip();
    await screen.findByText('2');

    expect(screen.getAllByLabelText('Adjusted p-value threshold')).toHaveLength(1);
    expect(screen.getAllByLabelText('Absolute log2 fold change threshold')).toHaveLength(1);
  });
});

describe('loading and failure', () => {
  it('says it is counting rather than showing a zero', async () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderStrip();

    expect(await screen.findByText(/Counting significant genes/i)).toBeInTheDocument();
  });

  it('admits when counts are unavailable', async () => {
    mockApi.get.mockRejectedValue(new Error('boom'));
    renderStrip();

    expect(await screen.findByText(/Counts unavailable/i)).toBeInTheDocument();
  });
});
