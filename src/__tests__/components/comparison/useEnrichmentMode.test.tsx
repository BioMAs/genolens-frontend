/**
 * The enrichment sub-mode, and why it lives in the fragment.
 *
 * It used to be local state, which meant a GSEA result could not be linked — in a file whose
 * own comment says the open view lives in the URL. The fragment is the right home for a
 * position *within* a screen: it does not re-render through `useSearchParams`, and the browser
 * restores it on reload.
 */
import { act, renderHook } from '@testing-library/react';
import { GSEA_HASH, useEnrichmentMode } from '@/components/comparison/useEnrichmentMode';

const setHash = (hash: string) =>
  window.history.replaceState(null, '', `/projects/p1/comparisons/A_vs_B${hash}`);

beforeEach(() => setHash(''));

describe('reading the fragment', () => {
  it('defaults to over-representation', () => {
    const { result } = renderHook(() => useEnrichmentMode(true));
    expect(result.current[0]).toBe('ora');
  });

  // Read during render, so a cold link opens on the ranked view rather than flashing ORA first.
  it('adopts a cold #gsea link on the very first render', () => {
    setHash(`#${GSEA_HASH}`);
    const { result } = renderHook(() => useEnrichmentMode(true));
    expect(result.current[0]).toBe('gsea');
  });

  it('ignores an unrelated fragment', () => {
    setHash('#enrichment');
    const { result } = renderHook(() => useEnrichmentMode(true));
    expect(result.current[0]).toBe('ora');
  });
});

describe('selecting a mode', () => {
  it('writes the fragment, which is what makes a GSEA result linkable', () => {
    const { result } = renderHook(() => useEnrichmentMode(true));

    act(() => result.current[1]('gsea'));

    expect(result.current[0]).toBe('gsea');
    expect(window.location.hash).toBe(`#${GSEA_HASH}`);
  });

  it('clears the fragment on the way back', () => {
    setHash(`#${GSEA_HASH}`);
    const { result } = renderHook(() => useEnrichmentMode(true));

    act(() => result.current[1]('ora'));

    expect(window.location.hash).toBe('');
  });

  it('leaves the path and query alone', () => {
    window.history.replaceState(null, '', '/projects/p1/comparisons/A_vs_B?view=comprendre');
    const { result } = renderHook(() => useEnrichmentMode(true));

    act(() => result.current[1]('gsea'));

    expect(window.location.pathname).toBe('/projects/p1/comparisons/A_vs_B');
    expect(window.location.search).toBe('?view=comprendre');
  });

  // replaceState, not `location.hash = …`: assigning the hash pushes a history entry, and
  // switching sub-view is not a navigation.
  it('does not pile up history entries', () => {
    const pushState = jest.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useEnrichmentMode(true));

    act(() => result.current[1]('gsea'));
    act(() => result.current[1]('ora'));

    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });
});

describe('the add-on guard', () => {
  // A #gsea link from someone who has the Scientific tools module must not leave a user who
  // does not on an empty pane.
  it('never reports gsea to a user without the module', () => {
    setHash(`#${GSEA_HASH}`);
    const { result } = renderHook(() => useEnrichmentMode(false));
    expect(result.current[0]).toBe('ora');
  });

  it('reports it again once the module is there', () => {
    setHash(`#${GSEA_HASH}`);
    const { result, rerender } = renderHook(({ allowed }) => useEnrichmentMode(allowed), {
      initialProps: { allowed: false },
    });
    expect(result.current[0]).toBe('ora');

    rerender({ allowed: true });
    expect(result.current[0]).toBe('gsea');
  });
});

describe('back and forward', () => {
  it('follows a fragment change it did not make', () => {
    const { result } = renderHook(() => useEnrichmentMode(true));
    expect(result.current[0]).toBe('ora');

    act(() => {
      setHash(`#${GSEA_HASH}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current[0]).toBe('gsea');
  });
});
