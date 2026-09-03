'use client';

/**
 * Shared state of the comparison results screens.
 *
 * Before this, the volcano and the DEG table each owned a private padj/log2FC pair
 * (`VolcanoPlot.tsx:19-20` and `DEGTable.tsx:44-45`) while the pane header printed
 * `log2FC threshold: 0.58 · padj: 0.05` as fixed text — three sources of truth in one view,
 * free to disagree. This is the one source.
 *
 * **Why a context and not a store.** The state is scoped to one route subtree: nothing outside
 * the comparison screens reads it. Zustand's selling points — no provider, global lifetime,
 * selector-based subscription — buy nothing when the store's lifetime equals one screen, while
 * the dependency would be a project-wide precedent and one more thing to mock across every Jest
 * suite. The re-render concern it would solve is handled by splitting the context in three: the
 * actions context holds only stable dispatchers, so it never re-renders, and a threshold change
 * cannot touch a consumer that only reads view preferences.
 *
 * **Hover deliberately does not live here.** At 5000 points and mouse-move frequency, a context
 * is the wrong tool; hover stays local to each chart. If cross-chart highlighting is ever wanted,
 * a mutable box read through `useSyncExternalStore` does it with zero React renders.
 *
 * The provider must be mounted **above** whatever switches between screens, or the state resets
 * every time the user changes view.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { readThresholds, thresholdsMatchUrl, writeThresholds } from '@/components/comparison/explorerUrl';
import { clampThresholds, type VolcanoThresholds } from '@/utils/volcano';

/** How long to wait after the last edit before touching the URL. */
const URL_WRITE_DEBOUNCE_MS = 250;

interface ViewPreferences {
  /** Colour-blind-safe palette, lifted out of the volcano so every chart agrees. */
  colorblind: boolean;
}

interface State {
  thresholds: VolcanoThresholds;
  prefs: ViewPreferences;
}

type Action =
  | { type: 'setThresholds'; value: Partial<VolcanoThresholds> }
  | { type: 'setColorblind'; value: boolean };

export interface ComparisonActions {
  /** Tighten one or both thresholds. Values are clamped to what ingestion honoured. */
  setThresholds(value: Partial<VolcanoThresholds>): void;
  setColorblind(value: boolean): void;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setThresholds': {
      const next = clampThresholds({ ...state.thresholds, ...action.value });
      // Preserve object identity when nothing moved, so memoised consumers do not re-render on
      // a slider that resolved back to the value it already had.
      if (next.padj === state.thresholds.padj && next.logfc === state.thresholds.logfc) {
        return state;
      }
      return { ...state, thresholds: next };
    }
    case 'setColorblind': {
      if (state.prefs.colorblind === action.value) return state;
      return { ...state, prefs: { ...state.prefs, colorblind: action.value } };
    }
    default:
      return state;
  }
}

const ThresholdsContext = createContext<VolcanoThresholds | null>(null);
const ViewPreferencesContext = createContext<ViewPreferences | null>(null);
const ActionsContext = createContext<ComparisonActions | null>(null);

export function ComparisonSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  // Read the URL at first render rather than in an effect, so a cold deep link paints the right
  // screen immediately instead of flashing the defaults.
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    thresholds: readThresholds(searchParams),
    prefs: { colorblind: false },
  }));

  const actions = useMemo<ComparisonActions>(
    () => ({
      setThresholds: (value) => dispatch({ type: 'setThresholds', value }),
      setColorblind: (value) => dispatch({ type: 'setColorblind', value }),
    }),
    []
  );

  useThresholdUrlSync(state.thresholds);

  return (
    <ActionsContext.Provider value={actions}>
      <ViewPreferencesContext.Provider value={state.prefs}>
        <ThresholdsContext.Provider value={state.thresholds}>{children}</ThresholdsContext.Provider>
      </ViewPreferencesContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * Mirror the thresholds into the query string, debounced.
 *
 * `replaceState` rather than `router.replace`: the latter round-trips the server component on
 * this route, which is what the tab switcher already avoids (`ComparisonDetail.tsx:82-90`).
 * The debounce matters — without it, dragging a control writes a history entry per intermediate
 * value and re-runs every `useSearchParams` consumer on the page.
 */
function useThresholdUrlSync(thresholds: VolcanoThresholds): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = new URLSearchParams(window.location.search);
      if (thresholdsMatchUrl(current, thresholds)) return;

      const next = writeThresholds(current, thresholds).toString();
      const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }, URL_WRITE_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [thresholds]);
}

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string): T {
  const value = useContext(context);
  if (value === null) {
    throw new Error(`${hookName} must be used inside <ComparisonSelectionProvider>`);
  }
  return value;
}

/** The page-wide thresholds. Re-renders only when they actually change. */
export function useThresholds(): VolcanoThresholds {
  return useRequiredContext(ThresholdsContext, 'useThresholds');
}

/** Chart preferences shared across the screen. Does not re-render on a threshold change. */
export function useViewPreferences(): ViewPreferences {
  return useRequiredContext(ViewPreferencesContext, 'useViewPreferences');
}

/** Stable dispatchers. This context never re-renders, so it is safe in a dependency array. */
export function useComparisonActions(): ComparisonActions {
  return useRequiredContext(ActionsContext, 'useComparisonActions');
}

/**
 * Thresholds plus a setter, for a control that owns both.
 *
 * Convenience over the two hooks above; a component that only *reads* should use `useThresholds`
 * so it does not also subscribe to the actions context.
 */
export function useThresholdControl(): [VolcanoThresholds, (value: Partial<VolcanoThresholds>) => void] {
  const thresholds = useThresholds();
  const { setThresholds } = useComparisonActions();
  const set = useCallback((value: Partial<VolcanoThresholds>) => setThresholds(value), [setThresholds]);
  return [thresholds, set];
}
