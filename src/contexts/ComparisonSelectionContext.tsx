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
import {
  readFocusedGene,
  readGeneListId,
  readThresholds,
  urlMatchesState,
  writeExplorerState,
} from '@/components/comparison/explorerUrl';
import { normalizeGeneKey } from '@/utils/geneKeys';
import { clampThresholds, type VolcanoThresholds } from '@/utils/volcano';

/** How long to wait after the last edit before touching the URL. */
const URL_WRITE_DEBOUNCE_MS = 250;

interface ViewPreferences {
  /** Colour-blind-safe palette, lifted out of the volcano so every chart agrees. */
  colorblind: boolean;
}

/** Where a selection came from. Panels use it to avoid echoing their own change back. */
export type SelectionSource =
  | 'volcano'
  | 'table'
  | 'pathway'
  | 'network'
  | 'search'
  | 'url'
  | 'geneList';

export interface ComparisonSelection {
  /**
   * Selected genes, in the order the user picked them, keys kept **as the source spelled them**.
   *
   * Not upper-cased: normalising for storage would display a mouse gene `Sox9` as `SOX9`.
   * Matching across sources goes through `geneKeys` instead, which compares on a normalised key
   * while the raw spelling survives for display.
   */
  genes: string[];
  /** The gene the detail card is about — the last one clicked, not merely selected. */
  focusedGene: string | null;
  source: SelectionSource;
  /** Human label for a multi-gene selection, e.g. a pathway or gene-list name. */
  label?: string;
  /**
   * The saved gene list this selection came from, when it came from one.
   *
   * A set of genes is only shareable as a link once it has been saved, so this — not the gene
   * array — is what reaches the URL.
   */
  listId?: string;
}

/**
 * An enriched pathway the reader is currently looking through.
 *
 * Shared rather than local to the enrichment panel, because three sibling sections react to
 * it: the network re-seeds from its genes, the signature panel pre-fills with them, and a focus
 * bar names it. Drilling one piece of state into three siblings is what a context is for.
 */
export interface FocusedTerm {
  id: string;
  name: string;
  genes: string[];
}

const EMPTY_SELECTION: ComparisonSelection = {
  genes: [],
  focusedGene: null,
  source: 'url',
};

interface State {
  thresholds: VolcanoThresholds;
  prefs: ViewPreferences;
  selection: ComparisonSelection;
  focusedTerm: FocusedTerm | null;
}

type Action =
  | { type: 'setThresholds'; value: Partial<VolcanoThresholds> }
  | { type: 'setColorblind'; value: boolean }
  | { type: 'selectGenes'; genes: string[]; source: SelectionSource; label?: string }
  | { type: 'selectGeneList'; listId: string; name: string; genes: string[] }
  | { type: 'toggleGene'; gene: string; source: SelectionSource }
  | { type: 'setFocusedGene'; gene: string | null }
  | { type: 'clearSelection' }
  | { type: 'focusTerm'; term: FocusedTerm | null };

export interface ComparisonActions {
  /** Tighten one or both thresholds. Values are clamped to what ingestion honoured. */
  setThresholds(value: Partial<VolcanoThresholds>): void;
  setColorblind(value: boolean): void;
  /** Replace the selection. The first gene becomes the focused one. */
  selectGenes(genes: string[], source: SelectionSource, label?: string): void;
  /** Select a saved gene list, which is the one multi-gene selection a URL can carry. */
  selectGeneList(listId: string, name: string, genes: string[]): void;
  /** Add a gene, or remove it if already selected — the shift-click gesture. */
  toggleGene(gene: string, source?: SelectionSource): void;
  /** Change which selected gene the detail card describes. */
  setFocusedGene(gene: string | null): void;
  clearSelection(): void;
  /** Look through one enriched pathway. Pass null to stop. */
  focusTerm(term: FocusedTerm | null): void;
}

/** Deduplicate by normalised key while keeping the first spelling seen, and drop empties. */
function dedupeGenes(genes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of genes) {
    const key = normalizeGeneKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

const sameGenes = (a: string[], b: string[]) =>
  a.length === b.length && a.every((gene, i) => gene === b[i]);

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
    case 'selectGenes': {
      const genes = dedupeGenes(action.genes);
      // One gene is its own subject; a set is not. A click focuses what it hit, a lasso of three
      // hundred genes focuses nothing and lets the card describe the set instead of arbitrarily
      // promoting whichever point happened to come first.
      const focusedGene = genes.length === 1 ? genes[0] : null;
      const { selection } = state;
      // Re-clicking the same point must not produce a new array: a fresh identity would
      // invalidate every memoised consumer downstream for no change at all.
      if (
        sameGenes(genes, selection.genes) &&
        focusedGene === selection.focusedGene &&
        action.source === selection.source &&
        action.label === selection.label
      ) {
        return state;
      }
      return {
        ...state,
        // A fresh selection is no longer the saved list it may have replaced.
        selection: { genes, focusedGene, source: action.source, label: action.label },
      };
    }
    case 'selectGeneList': {
      const genes = dedupeGenes(action.genes);
      if (
        state.selection.listId === action.listId &&
        sameGenes(genes, state.selection.genes)
      ) {
        return state;
      }
      return {
        ...state,
        selection: {
          genes,
          focusedGene: null,
          source: 'geneList',
          label: action.name,
          listId: action.listId,
        },
      };
    }
    case 'toggleGene': {
      const key = normalizeGeneKey(action.gene);
      if (!key) return state;

      const { selection } = state;
      const without = selection.genes.filter((gene) => normalizeGeneKey(gene) !== key);
      const wasSelected = without.length !== selection.genes.length;
      const genes = wasSelected ? without : [...selection.genes, action.gene];

      return {
        ...state,
        selection: {
          genes,
          // Removing the focused gene hands focus to whatever is left, rather than emptying
          // the card while genes are still selected.
          focusedGene: wasSelected
            ? normalizeGeneKey(selection.focusedGene) === key
              ? genes[genes.length - 1] ?? null
              : selection.focusedGene
            : action.gene,
          source: action.source,
          label: undefined,
        },
      };
    }
    case 'setFocusedGene': {
      if (action.gene === state.selection.focusedGene) return state;
      return { ...state, selection: { ...state.selection, focusedGene: action.gene } };
    }
    case 'clearSelection': {
      if (state.selection.genes.length === 0 && state.selection.focusedGene === null) {
        return state;
      }
      return { ...state, selection: EMPTY_SELECTION };
    }
    case 'focusTerm': {
      if (state.focusedTerm?.id === action.term?.id) return state;
      return { ...state, focusedTerm: action.term };
    }
    default:
      return state;
  }
}

const ThresholdsContext = createContext<VolcanoThresholds | null>(null);
const ViewPreferencesContext = createContext<ViewPreferences | null>(null);
const SelectionContext = createContext<ComparisonSelection | null>(null);
const PendingGeneListContext = createContext<string | null>(null);
const FocusedTermContext = createContext<FocusedTerm | null | undefined>(undefined);
const ActionsContext = createContext<ComparisonActions | null>(null);

export function ComparisonSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  // Read the URL at first render rather than in an effect, so a cold deep link paints the right
  // screen immediately instead of flashing the defaults.
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const gene = readFocusedGene(searchParams);
    return {
      thresholds: readThresholds(searchParams),
      prefs: { colorblind: false },
      focusedTerm: null,
      selection: gene
        ? { genes: [gene], focusedGene: gene, source: 'url' as SelectionSource }
        : EMPTY_SELECTION,
    };
  });

  /**
   * A `?geneList=` link cannot be resolved here: its genes are not in the URL, they are in the
   * API. The id is exposed instead, and `GeneListDeepLink` fetches the list and applies it.
   */
  const pendingGeneListId = readGeneListId(searchParams);

  const actions = useMemo<ComparisonActions>(
    () => ({
      setThresholds: (value) => dispatch({ type: 'setThresholds', value }),
      setColorblind: (value) => dispatch({ type: 'setColorblind', value }),
      selectGenes: (genes, source, label) =>
        dispatch({ type: 'selectGenes', genes, source, label }),
      selectGeneList: (listId, name, genes) =>
        dispatch({ type: 'selectGeneList', listId, name, genes }),
      toggleGene: (gene, source = 'volcano') => dispatch({ type: 'toggleGene', gene, source }),
      setFocusedGene: (gene) => dispatch({ type: 'setFocusedGene', gene }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      focusTerm: (term) => dispatch({ type: 'focusTerm', term }),
    }),
    []
  );

  useExplorerUrlSync(state.thresholds, state.selection);

  return (
    <ActionsContext.Provider value={actions}>
      <PendingGeneListContext.Provider
        value={state.selection.genes.length === 0 ? pendingGeneListId : null}
      >
      <FocusedTermContext.Provider value={state.focusedTerm}>
        <ViewPreferencesContext.Provider value={state.prefs}>
          <SelectionContext.Provider value={state.selection}>
            <ThresholdsContext.Provider value={state.thresholds}>
              {children}
            </ThresholdsContext.Provider>
          </SelectionContext.Provider>
        </ViewPreferencesContext.Provider>
      </FocusedTermContext.Provider>
      </PendingGeneListContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * Mirror the shareable part of the state into the query string, debounced.
 *
 * Shareable means the thresholds and **one** focused gene. A lasso of three hundred genes does
 * not belong in a URL — its shareable form is a saved gene list — so a multi-gene selection
 * writes only its focused gene, and the rest is deliberately not recoverable from the link.
 *
 * `replaceState` rather than `router.replace`: the latter round-trips the server component on
 * this route, which is what the tab switcher already avoids (`ComparisonDetail.tsx:82-90`).
 * The debounce matters — without it, dragging a control writes a history entry per intermediate
 * value and re-runs every `useSearchParams` consumer on the page.
 */
function useExplorerUrlSync(
  thresholds: VolcanoThresholds,
  selection: ComparisonSelection
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedGene = selection.focusedGene;
  const listId = selection.listId ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = new URLSearchParams(window.location.search);
      if (urlMatchesState(current, thresholds, focusedGene, listId)) return;

      const next = writeExplorerState(current, thresholds, focusedGene, listId).toString();
      const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }, URL_WRITE_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [thresholds, focusedGene, listId]);
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

/**
 * The current gene selection.
 *
 * Note what is **not** here: the hovered gene. At five thousand points and mouse-move frequency
 * a context is the wrong tool, so hover stays local to each chart. If cross-chart highlighting
 * is ever wanted, a mutable box read through `useSyncExternalStore` does it with zero renders.
 */
export function useSelection(): ComparisonSelection {
  return useRequiredContext(SelectionContext, 'useSelection');
}

/** The pathway being looked through, or null. */
export function useFocusedTerm(): FocusedTerm | null {
  const value = useContext(FocusedTermContext);
  if (value === undefined) {
    throw new Error('useFocusedTerm must be used inside <ComparisonSelectionProvider>');
  }
  return value;
}

/** Chart preferences shared across the screen. Does not re-render on a threshold change. */
export function useViewPreferences(): ViewPreferences {
  return useRequiredContext(ViewPreferencesContext, 'useViewPreferences');
}

/**
 * The gene list a URL points at, when the selection has not been resolved from it yet.
 *
 * Null once something is selected, so applying the list is a one-shot: the user is then free to
 * change the selection without the link pulling it back.
 */
export function usePendingGeneListId(): string | null {
  return useContext(PendingGeneListContext);
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
