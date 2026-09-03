import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// jest.setup.tsx mocks useSearchParams as an always-empty URLSearchParams, which cannot exercise
// a cold deep link. Override it per-file so the query string is controllable.
let mockSearch = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => '/projects/p1/comparisons/A_vs_B',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useParams: () => ({}),
}));

import {
  ComparisonSelectionProvider,
  useComparisonActions,
  useSelection,
  useThresholdControl,
  useThresholds,
  useViewPreferences,
} from '@/contexts/ComparisonSelectionContext';
import { DEFAULT_THRESHOLDS } from '@/utils/volcano';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ComparisonSelectionProvider>{children}</ComparisonSelectionProvider>
);

const setUrl = (search: string) => {
  mockSearch = search;
  window.history.replaceState(
    null,
    '',
    `/projects/p1/comparisons/A_vs_B${search ? `?${search}` : ''}`
  );
};

beforeEach(() => {
  jest.useFakeTimers();
  setUrl('');
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('initial state', () => {
  it('starts at the ingestion defaults when the URL says nothing', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper });
    expect(result.current).toEqual(DEFAULT_THRESHOLDS);
  });

  // A cold deep link must paint the right screen on the first render, not flash the defaults —
  // which is why the provider reads the URL during render rather than in an effect.
  it('adopts a deep link on the very first render', () => {
    setUrl('padj=0.001&lfc=2');
    const { result } = renderHook(() => useThresholds(), { wrapper });
    expect(result.current).toEqual({ padj: 0.001, logfc: 2 });
  });

  it('clamps a deep link that asks for a looser threshold than ingestion kept', () => {
    setUrl('padj=0.5&lfc=0');
    const { result } = renderHook(() => useThresholds(), { wrapper });
    expect(result.current).toEqual(DEFAULT_THRESHOLDS);
  });

  it('starts with the standard palette', () => {
    const { result } = renderHook(() => useViewPreferences(), { wrapper });
    expect(result.current.colorblind).toBe(false);
  });
});

describe('setThresholds', () => {
  it('tightens one threshold without disturbing the other', () => {
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: 0.001 }));

    expect(result.current[0]).toEqual({ padj: 0.001, logfc: DEFAULT_THRESHOLDS.logfc });
  });

  it('clamps a value looser than ingestion', () => {
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: 0.5, logfc: 0.1 }));

    expect(result.current[0]).toEqual(DEFAULT_THRESHOLDS);
  });

  it('ignores a non-finite value instead of spreading NaN through every comparison', () => {
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: Number.NaN }));

    expect(result.current[0].padj).toBe(DEFAULT_THRESHOLDS.padj);
  });

  // Re-render hygiene: a control that resolves back to the value it already had must not
  // invalidate every memoised consumer downstream.
  it('preserves object identity when nothing actually moved', () => {
    const { result } = renderHook(
      () => ({ thresholds: useThresholds(), actions: useComparisonActions() }),
      { wrapper }
    );
    const before = result.current.thresholds;

    act(() => result.current.actions.setThresholds({ padj: DEFAULT_THRESHOLDS.padj }));
    expect(result.current.thresholds).toBe(before);

    // a looser value clamps back onto the default, so it must not count as a change either
    act(() => result.current.actions.setThresholds({ padj: 0.9 }));
    expect(result.current.thresholds).toBe(before);

    // and a real move does produce a new object
    act(() => result.current.actions.setThresholds({ padj: 0.01 }));
    expect(result.current.thresholds).not.toBe(before);
  });
});

describe('setColorblind', () => {
  it('toggles the palette', () => {
    const { result } = renderHook(
      () => ({ prefs: useViewPreferences(), actions: useComparisonActions() }),
      { wrapper }
    );

    act(() => result.current.actions.setColorblind(true));
    expect(result.current.prefs.colorblind).toBe(true);
  });

  it('preserves identity when set to the value it already had', () => {
    const { result } = renderHook(
      () => ({ prefs: useViewPreferences(), actions: useComparisonActions() }),
      { wrapper }
    );
    const before = result.current.prefs;

    act(() => result.current.actions.setColorblind(false));
    expect(result.current.prefs).toBe(before);
  });
});

describe('URL mirroring', () => {
  it('writes a tightened threshold once the edits settle', () => {
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: 0.001 }));
    expect(window.location.search).toBe(''); // still debouncing

    act(() => jest.advanceTimersByTime(300));
    expect(new URLSearchParams(window.location.search).get('padj')).toBe('0.001');
  });

  it('collapses a burst of edits into a single history write', () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: 0.04 }));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current[1]({ padj: 0.03 }));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current[1]({ padj: 0.01 }));
    act(() => jest.advanceTimersByTime(300));

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(window.location.search).get('padj')).toBe('0.01');
    replaceState.mockRestore();
  });

  it('drops the parameter again when the threshold returns to its default', () => {
    setUrl('padj=0.001');
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: DEFAULT_THRESHOLDS.padj }));
    act(() => jest.advanceTimersByTime(300));

    expect(window.location.search).toBe('');
  });

  it('leaves unrelated parameters in place', () => {
    setUrl('tab=deg&datasetId=abc');
    const { result } = renderHook(() => useThresholdControl(), { wrapper });

    act(() => result.current[1]({ padj: 0.01 }));
    act(() => jest.advanceTimersByTime(300));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('deg');
    expect(params.get('datasetId')).toBe('abc');
    expect(params.get('padj')).toBe('0.01');
  });

  it('never writes when the state already matches the URL', () => {
    setUrl('padj=0.01');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    renderHook(() => useThresholds(), { wrapper });
    act(() => jest.advanceTimersByTime(300));

    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });
});

describe('provider requirement', () => {
  it('fails loudly instead of silently returning defaults', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useThresholds())).toThrow(/ComparisonSelectionProvider/);
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gene selection
// ─────────────────────────────────────────────────────────────────────────────

const useSel = () => ({ selection: useSelection(), actions: useComparisonActions() });

describe('selectGenes', () => {
  it('starts empty', () => {
    const { result } = renderHook(useSel, { wrapper });
    expect(result.current.selection).toMatchObject({ genes: [], focusedGene: null });
  });

  it('replaces the selection and focuses the first gene', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    expect(result.current.selection).toMatchObject({
      genes: ['TP53'],
      focusedGene: 'TP53',
      source: 'volcano',
    });

    act(() => result.current.actions.selectGenes(['SOX9', 'MUC16'], 'pathway', 'Wnt signaling'));
    expect(result.current.selection).toMatchObject({
      genes: ['SOX9', 'MUC16'],
      focusedGene: 'SOX9',
      label: 'Wnt signaling',
    });
  });

  // Storing an upper-cased key would render a mouse gene Sox9 as SOX9.
  it('keeps the spelling the source used, while still deduplicating case-insensitively', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['Sox9', 'SOX9', ' sox9 '], 'volcano'));

    expect(result.current.selection.genes).toEqual(['Sox9']);
  });

  it('drops empty entries rather than selecting a blank', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['', '  ', 'TP53'], 'volcano'));

    expect(result.current.selection.genes).toEqual(['TP53']);
  });

  // Re-render hygiene: clicking the same point twice must not invalidate memoised consumers.
  it('preserves identity when the same selection is made again', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    const before = result.current.selection;

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    expect(result.current.selection).toBe(before);
  });
});

describe('toggleGene', () => {
  it('adds a gene that is not selected, and focuses it', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    act(() => result.current.actions.toggleGene('SOX9'));

    expect(result.current.selection.genes).toEqual(['TP53', 'SOX9']);
    expect(result.current.selection.focusedGene).toBe('SOX9');
  });

  it('removes a gene that is already selected, whatever its spelling', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53', 'SOX9'], 'volcano'));
    act(() => result.current.actions.toggleGene('sox9'));

    expect(result.current.selection.genes).toEqual(['TP53']);
  });

  // Emptying the card while genes are still selected would be a dead end.
  it('hands focus to a remaining gene when the focused one is removed', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53', 'SOX9'], 'volcano'));
    act(() => result.current.actions.setFocusedGene('SOX9'));
    act(() => result.current.actions.toggleGene('SOX9'));

    expect(result.current.selection.genes).toEqual(['TP53']);
    expect(result.current.selection.focusedGene).toBe('TP53');
  });

  it('leaves focus alone when a different gene is removed', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53', 'SOX9'], 'volcano'));
    act(() => result.current.actions.toggleGene('SOX9'));

    expect(result.current.selection.focusedGene).toBe('TP53');
  });

  it('ignores an empty gene', () => {
    const { result } = renderHook(useSel, { wrapper });
    const before = result.current.selection;

    act(() => result.current.actions.toggleGene('   '));
    expect(result.current.selection).toBe(before);
  });
});

describe('setFocusedGene and clearSelection', () => {
  it('moves the card to another selected gene without changing the selection', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53', 'SOX9'], 'volcano'));
    act(() => result.current.actions.setFocusedGene('SOX9'));

    expect(result.current.selection.focusedGene).toBe('SOX9');
    expect(result.current.selection.genes).toEqual(['TP53', 'SOX9']);
  });

  it('empties both the selection and the focus', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    act(() => result.current.actions.clearSelection());

    expect(result.current.selection).toMatchObject({ genes: [], focusedGene: null });
  });

  it('preserves identity when clearing an already-empty selection', () => {
    const { result } = renderHook(useSel, { wrapper });
    const before = result.current.selection;

    act(() => result.current.actions.clearSelection());
    expect(result.current.selection).toBe(before);
  });
});

describe('the focused gene in the URL', () => {
  it('adopts a ?gene= deep link on the first render', () => {
    setUrl('gene=TP53');
    const { result } = renderHook(useSel, { wrapper });

    expect(result.current.selection).toMatchObject({
      genes: ['TP53'],
      focusedGene: 'TP53',
      source: 'url',
    });
  });

  it('writes the focused gene once the clicks settle', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    act(() => jest.advanceTimersByTime(300));

    expect(new URLSearchParams(window.location.search).get('gene')).toBe('TP53');
  });

  // A lasso is not a stable artifact worth a permalink; its shareable form is a gene list.
  it('writes only the focused gene of a multi-gene selection', () => {
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.selectGenes(['TP53', 'SOX9', 'MUC16'], 'volcano'));
    act(() => jest.advanceTimersByTime(300));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('gene')).toBe('TP53');
    expect(params.toString()).not.toContain('SOX9');
  });

  it('drops the parameter when the selection is cleared', () => {
    setUrl('gene=TP53');
    const { result } = renderHook(useSel, { wrapper });

    act(() => result.current.actions.clearSelection());
    act(() => jest.advanceTimersByTime(300));

    expect(window.location.search).toBe('');
  });

  it('keeps the thresholds alongside the gene', () => {
    const { result } = renderHook(
      () => ({ ...useSel(), control: useThresholdControl() }),
      { wrapper }
    );

    act(() => result.current.actions.selectGenes(['TP53'], 'volcano'));
    act(() => result.current.control[1]({ padj: 0.001 }));
    act(() => jest.advanceTimersByTime(300));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('gene')).toBe('TP53');
    expect(params.get('padj')).toBe('0.001');
  });
});
