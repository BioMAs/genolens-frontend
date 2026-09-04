/**
 * The two DEG counters on the results screen must agree.
 *
 * The bug: the header read "1,185 up in Time 20 / 1,006 down" while the overview strip, a few
 * hundred pixels below and captioned with the same thresholds, read "1,195 up / 1,018 down".
 * They were computing different things — the header showed numbers frozen at ingestion (on some
 * datasets the upstream pipeline's `contrast:` labels, which never had padj/log2FC applied at
 * all; on others `padj < 0.05` with *no* log2FC filter), while the overview recounted the volcano
 * cloud at the live thresholds. Only the overview moved when you touched the threshold control.
 *
 * The unit tests for `useSignificanceSummary` cover the hook. What this file pins down is the
 * thing a user actually sees: the same two components, rendered together, showing one number.
 *
 * The harness mirrors how `ComparisonDetail` wires them — one call to the shared hook feeding the
 * synthesis, the strip calling it for itself.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import ComparisonSynthesis from '@/components/comparison/ComparisonSynthesis';
import SynthesisStrip from '@/components/comparison/explorer/SynthesisStrip';
import { useSignificanceSummary } from '@/hooks/useSignificanceSummary';
import {
  ComparisonSelectionProvider,
  useThresholds,
} from '@/contexts/ComparisonSelectionContext';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const COMPARISON = 'Time20_vs_Time0';

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true, // the server's verdict, deliberately wrong
});

/**
 * At padj < 0.05 / |lfc| > 0.58 → 3 up, 2 down.
 * At padj < 0.001              → 2 up, 1 down.
 */
const CLOUD = [
  point('UP_A', 3.2, 1e-9),
  point('UP_B', 2.1, 1e-5),
  point('UP_C', 1.4, 0.01),
  point('DOWN_A', -2.7, 1e-8),
  point('DOWN_B', -1.1, 0.02),
  point('NS_PADJ', 4.0, 0.2),
  point('NS_LFC', 0.2, 1e-9),
];

/** Mirrors ComparisonDetail: one hook call feeds the synthesis, the strip calls it itself. */
function Harness() {
  const { summary, isLoading } = useSignificanceSummary('ds-1', COMPARISON);
  const thresholds = useThresholds();

  const stats = summary
    ? { degUp: summary.up, degDown: summary.down, degTotal: summary.significant, genesTested: 20000 }
    : null;

  return (
    <>
      <div data-testid="header">
        <ComparisonSynthesis
          comparisonName={COMPARISON}
          stats={stats}
          sampleConditionMap={{ s1: 'Time20', s2: 'Time0' }}
          loading={isLoading}
          padjThreshold={thresholds.padj}
          log2fcThreshold={thresholds.logfc}
        />
      </div>
      <SynthesisStrip datasetId="ds-1" comparisonName={COMPARISON} />
    </>
  );
}

function renderBoth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <Harness />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: {
      dataset_id: 'ds-1',
      comparison_name: COMPARISON,
      points: CLOUD,
      total_genes: CLOUD.length,
      significant_genes: 999, // deliberately wrong — neither counter may use it
      cached: true,
    },
  });
});

/**
 * The strip's own numbers, read off the balance bar's aria-label — a single stable string
 * ("N genes up and M down out of T significant") rather than a walk over sibling nodes.
 */
function stripCounts() {
  const strip = screen.getByTestId('synthesis-strip');
  const label = within(strip).getByRole('img').getAttribute('aria-label') ?? '';
  const m = /^([\d,]+) genes up and ([\d,]+) down/.exec(label);
  if (!m) throw new Error(`unreadable strip label: ${label}`);
  return { up: m[1], down: m[2] };
}

describe('the two counters', () => {
  it('show the same up and down at the default thresholds', async () => {
    renderBoth();
    await waitFor(() => expect(screen.getByTestId('synthesis-strip')).toBeInTheDocument());

    const header = screen.getByTestId('header');
    await waitFor(() => expect(within(header).getByText(/up in Time20/)).toBeInTheDocument());

    // The regression, stated plainly: one number, in both places.
    expect(within(header).getByText(/↑\s*3 up in Time20/)).toBeInTheDocument();
    expect(within(header).getByText(/↓\s*2 down/)).toBeInTheDocument();
    expect(stripCounts()).toEqual({ up: '3', down: '2' });
  });

  it('ignore the server verdict in significant_genes', async () => {
    renderBoth();
    const header = screen.getByTestId('header');
    await waitFor(() => expect(within(header).getByText(/genes respond/)).toBeInTheDocument());

    expect(within(header).queryByText(/999/)).not.toBeInTheDocument();
    expect(within(header).getByText(/5 genes respond/)).toBeInTheDocument();
  });

  it('both follow the threshold control', async () => {
    const user = userEvent.setup();
    renderBoth();

    const header = screen.getByTestId('header');
    await waitFor(() => expect(within(header).getByText(/↑\s*3 up in Time20/)).toBeInTheDocument());

    // Tighten padj through the strip's own control.
    await user.selectOptions(screen.getByLabelText('Adjusted p-value threshold'), '0.001');

    await waitFor(() => expect(stripCounts()).toEqual({ up: '2', down: '1' }));
    // The header used to sit at its ingestion-time value no matter what this control did.
    expect(within(header).getByText(/↑\s*2 up in Time20/)).toBeInTheDocument();
    expect(within(header).getByText(/↓\s*1 down/)).toBeInTheDocument();
  });

  it('caption the header with the thresholds that produced its numbers', async () => {
    const user = userEvent.setup();
    renderBoth();

    const header = screen.getByTestId('header');
    // Strict `<`, matching isSignificant — the caption used to claim `≤`.
    await waitFor(() => expect(within(header).getByText(/padj < 0\.05/)).toBeInTheDocument());
    expect(within(header).getByText(/\|log2FC\| > 0\.58/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Adjusted p-value threshold'), '0.001');

    // The caption used to be a hardcoded default that no caller ever overrode.
    await waitFor(() => expect(within(header).getByText(/padj < 0\.001/)).toBeInTheDocument());
  });
});
