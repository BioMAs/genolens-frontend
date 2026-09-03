/**
 * The volcano's selection adapter.
 *
 * Testing Plotly itself in jsdom is pointless — there is no WebGL and no layout — so
 * `next/dynamic` is stubbed with a component that records the props and exposes one button per
 * plotted point. What is worth testing is precisely the adapter: that Plotly's
 * `(curveNumber, pointNumber)` resolves back to the right gene, that a selection made elsewhere
 * is written *into* the plot, and that the plot cannot paint a white block in dark mode.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

interface StubTrace {
  x?: number[];
  name?: string;
  selectedpoints?: number[];
  marker?: { color?: string };
  type?: string;
}

interface PointRef {
  curveNumber: number;
  pointNumber: number;
}

interface StubProps {
  data: StubTrace[];
  layout: { paper_bgcolor?: string; plot_bgcolor?: string; shapes?: unknown[] };
  config: { modeBarButtonsToRemove?: string[] };
  onClick?: (event: {
    points: PointRef[];
    event: { shiftKey: boolean; metaKey: boolean };
  }) => void;
  onSelected?: (event?: { points?: PointRef[] }) => void;
  onDeselect?: () => void;
}

/**
 * Props are recorded through a spy rather than by assigning to an outer variable: the React
 * compiler lint rule rightly forbids mutating outer state from inside a component, and calling
 * a function is not a mutation.
 */
const recordProps = jest.fn<void, [StubProps]>();

/** The props of the most recent render. */
const lastProps = (): StubProps => {
  const calls = recordProps.mock.calls;
  if (calls.length === 0) throw new Error('the plot stub has not rendered yet');
  return calls[calls.length - 1][0];
};

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Stub = (props: StubProps) => {
      recordProps(props);
      return (
        <div data-testid="plot-stub">
          {props.data.map((trace, curveNumber) =>
            (trace.x ?? []).map((_, pointNumber) => (
              <button
                key={`${curveNumber}-${pointNumber}`}
                type="button"
                onClick={(event) =>
                  props.onClick?.({
                    points: [{ curveNumber, pointNumber }],
                    event: { shiftKey: event.shiftKey, metaKey: event.metaKey },
                  })
                }
              >
                {`pt-${curveNumber}-${pointNumber}`}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() =>
              props.onSelected?.({
                points: props.data.flatMap((trace, curveNumber) =>
                  (trace.x ?? []).map((_, pointNumber) => ({ curveNumber, pointNumber }))
                ),
              })
            }
          >
            lasso-all
          </button>
          <button type="button" onClick={() => props.onSelected?.({ points: [] })}>
            lasso-empty
          </button>
          <button type="button" onClick={() => props.onSelected?.(undefined)}>
            lasso-undefined
          </button>
          <button type="button" onClick={() => props.onDeselect?.()}>
            deselect
          </button>
        </div>
      );
    };
    Stub.displayName = 'PlotStub';
    return Stub;
  },
}));

jest.mock('@/components/AIChartAssistant', () => {
  const Stub = () => null;
  Stub.displayName = 'AIChartAssistant';
  return { __esModule: true, default: Stub };
});

import VolcanoPanel from '@/components/comparison/explorer/VolcanoPanel';
import SelectionCard from '@/components/comparison/explorer/SelectionCard';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UNKNOWN_GENE } from '@/utils/volcano';
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

/** Ordered so the expected buckets are unambiguous: ns first, then down, then up. */
const CLOUD = [
  point('NS_GENE', 0.1, 0.5),
  point(UNKNOWN_GENE, 4, 1e-9),
  point('DOWN_GENE', -2.5, 1e-8),
  point('UP_GENE', 3.1, 1e-9),
  point('Sox9', 1.2, 1e-4),
];

function renderPanel(children?: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ComparisonSelectionProvider>
          <VolcanoPanel dataset={DATASET} comparisonName={COMPARISON} />
          {children}
        </ComparisonSelectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Buttons are named pt-<curveNumber>-<pointNumber>. Traces are [ns, down, up], and each bucket
 * keeps cloud order, so for the fixture below:
 *
 *   (0,0) NS_GENE · (1,0) DOWN_GENE · (2,0) Unknown · (2,1) UP_GENE · (2,2) Sox9
 */
async function clickPoint(curve: number, index: number, opts?: { shift?: boolean }) {
  const target = screen.getByText(`pt-${curve}-${index}`);
  if (opts?.shift) {
    // fireEvent, not userEvent: the default userEvent export builds a fresh instance per call,
    // so a preceding `keyboard('{Shift>}')` does not reach the click. Setting the modifier on
    // the event is what the component actually reads.
    fireEvent.click(target, { shiftKey: true });
    return;
  }
  await userEvent.click(target);
}

// jsdom has no matchMedia, and ThemeProvider reads it to pick up the system preference.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  recordProps.mockClear();
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
});

describe('trace layout', () => {
  it('splits the cloud into three traces, in the order curveNumber depends on', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    const names = lastProps().data.map((t) => t.name);
    expect(names).toEqual(['Not significant', 'Downregulated', 'Upregulated']);
  });

  it('puts the points on WebGL rather than one SVG node each', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    expect(lastProps().data.every((t) => t.type === 'scattergl')).toBe(true);
  });

  it('colours up green and down red, the convention the rest of the app uses', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    const [, down, up] = lastProps().data;
    expect(up.marker?.color).toBe('#22c55e');
    expect(down.marker?.color).toBe('#ef4444');
  });

  it('draws a threshold line for each bound plus its mirror', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    // +logfc, -logfc, and the padj line
    expect(lastProps().layout.shapes).toHaveLength(3);
  });
});

describe('clicking a point', () => {
  it('resolves curveNumber and pointNumber back to the right gene', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    // index 2 of the up trace, not index 0 — a map that only worked for the first point
    // would pass a weaker test
    await clickPoint(2, 2);

    expect(await screen.findByTitle('Sox9')).toBeInTheDocument();
  });

  it('replaces the selection on a plain click', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await clickPoint(2, 1);
    expect(await screen.findByTitle('UP_GENE')).toBeInTheDocument();

    await clickPoint(1, 0);
    expect(await screen.findByTitle('DOWN_GENE')).toBeInTheDocument();
    expect(screen.queryByTitle('UP_GENE')).toBeNull();
  });

  it('adds to the selection on a shift-click', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await clickPoint(2, 1);
    await clickPoint(1, 0, { shift: true });

    // the shift-clicked gene takes focus, and the first one is listed as also selected
    expect(await screen.findByTitle('DOWN_GENE')).toBeInTheDocument();
    expect(screen.getByText('Also selected')).toBeInTheDocument();
    expect(screen.getByTitle('Show UP_GENE')).toBeInTheDocument();
  });

  // The backend substitutes this sentinel when a dataset has no recognisable gene column.
  // Selecting it would put a non-gene in the card and in the URL.
  it('refuses the Unknown sentinel', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    // Unknown is significant and positive, so it is the up trace's first point
    await clickPoint(2, 0);

    expect(screen.queryByTitle(UNKNOWN_GENE)).toBeNull();
    expect(screen.getByText('No gene selected')).toBeInTheDocument();
  });
});

describe('a selection made elsewhere', () => {
  it('is written back into the plot, so the table can highlight the plot', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    expect(lastProps().data[0].selectedpoints).toBeUndefined();

    await clickPoint(2, 1);

    await waitFor(() => {
      const traces = lastProps().data;
      const total = traces.reduce((n, t) => n + (t.selectedpoints?.length ?? 0), 0);
      expect(total).toBe(1);
    });
  });
});

describe('theme and controls', () => {
  // A painted background is the dark-mode bug this replaces: the previous Plotly components
  // hardcoded '#ffffff'.
  it('paints no background of its own', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    expect(lastProps().layout.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(lastProps().layout.plot_bgcolor).toBe('rgba(0,0,0,0)');
  });

  // Every other Plotly component in the app strips these; here they are the feature.
  it('keeps the lasso and box-select buttons', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    const removed = lastProps().config.modeBarButtonsToRemove ?? [];
    expect(removed).not.toContain('lasso2d');
    expect(removed).not.toContain('select2d');
  });

  it('tells the user how to select before anything is selected', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    expect(screen.getByText(/Click a point to inspect a gene/i)).toBeInTheDocument();
  });
});

describe('lasso selection', () => {
  it('takes the whole set, and lets the set describe itself rather than picking a gene', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await userEvent.click(screen.getByText('lasso-all'));

    // four real genes out of five points: the Unknown sentinel is dropped
    const card = await screen.findByTestId('multi-selection-card');
    expect(card).toHaveTextContent('4 genes selected');
    expect(card).toHaveTextContent(/Lasso · 4 genes/);
  });

  it('reports the up and down split of the set', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await userEvent.click(screen.getByText('lasso-all'));
    const card = await screen.findByTestId('multi-selection-card');

    // UP_GENE and Sox9 are up, DOWN_GENE is down, NS_GENE has no verdict at these thresholds
    expect(card).toHaveTextContent('2 up');
    expect(card).toHaveTextContent('1 down');
    expect(card).toHaveTextContent(/1 without a verdict here/);
  });

  // Plotly fires plotly_selected while the lasso is still being drawn, and again with an empty
  // payload when a selection is dismissed. Neither is an instruction to clear.
  it('ignores an empty or absent payload instead of wiping the selection', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await clickPoint(2, 1);
    expect(await screen.findByTitle('UP_GENE')).toBeInTheDocument();

    await userEvent.click(screen.getByText('lasso-empty'));
    await userEvent.click(screen.getByText('lasso-undefined'));

    expect(screen.getByTitle('UP_GENE')).toBeInTheDocument();
  });

  it('clears on deselect, which is the gesture that actually means it', async () => {
    renderPanel(<SelectionCard dataset={DATASET} comparisonName={COMPARISON} />);
    await screen.findByTestId('plot-stub');

    await userEvent.click(screen.getByText('lasso-all'));
    await screen.findByTestId('multi-selection-card');

    await userEvent.click(screen.getByText('deselect'));

    expect(await screen.findByText('No gene selected')).toBeInTheDocument();
  });

  it('writes every lassoed gene back into the plot', async () => {
    renderPanel();
    await screen.findByTestId('plot-stub');

    await userEvent.click(screen.getByText('lasso-all'));

    await waitFor(() => {
      const total = lastProps().data.reduce((n, t) => n + (t.selectedpoints?.length ?? 0), 0);
      expect(total).toBe(4);
    });
  });
});
