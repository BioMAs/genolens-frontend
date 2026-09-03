/**
 * The pathway cross-filter, in its three tiers.
 *
 * This is what makes merging the screens *useful* rather than merely compact. Clicking an
 * enriched term does not navigate: the network re-seeds from its genes and the signature panel
 * pre-fills with them, both a scroll away on the same screen. Without the merge, that would
 * have to be a navigation, and the connection would be invisible.
 *
 * Tier 1 is that in-place focus. Tier 2 is the one explicit crossing — "show these in
 * Explore" — which the user asks for. Tier 3 is passive: a selection made in Explore becomes
 * legible in the enrichment table without anyone going anywhere.
 */
import { act, renderHook, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
  useFocusedTerm,
  useSelection,
} from '@/contexts/ComparisonSelectionContext';
import PathwayFocusBar from '@/components/comparison/comprendre/PathwayFocusBar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ComparisonSelectionProvider>{children}</ComparisonSelectionProvider>
);

const TERM = { id: 'GO:0006915', name: 'Apoptotic process', genes: ['TP53', 'MDM2', 'BAX'] };

const useBoth = () => ({
  term: useFocusedTerm(),
  selection: useSelection(),
  actions: useComparisonActions(),
});

describe('tier 1 — focusing a pathway', () => {
  it('records the term and its genes, which is what the siblings react to', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.actions.focusTerm(TERM));

    expect(result.current.term).toEqual(TERM);
  });

  // The point of tier 1: focusing does not select. The network and the signature read the
  // term; Explore's selection is untouched until the user asks for it.
  it('leaves the gene selection alone', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.actions.selectGenes(['BRCA1'], 'volcano'));
    act(() => result.current.actions.focusTerm(TERM));

    expect(result.current.selection.genes).toEqual(['BRCA1']);
  });

  it('replaces one focus with the next', () => {
    const { result } = renderHook(useBoth, { wrapper });
    const other = { id: 'GO:0007049', name: 'Cell cycle', genes: ['CCNB1'] };

    act(() => result.current.actions.focusTerm(TERM));
    act(() => result.current.actions.focusTerm(other));

    expect(result.current.term).toEqual(other);
  });

  it('clears on null', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.actions.focusTerm(TERM));
    act(() => result.current.actions.focusTerm(null));

    expect(result.current.term).toBeNull();
  });

  it('preserves identity when the same term is focused again', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.actions.focusTerm(TERM));
    const before = result.current.term;

    act(() => result.current.actions.focusTerm({ ...TERM }));
    expect(result.current.term).toBe(before);
  });
});

describe('the focus bar', () => {
  function Harness({ onShow }: { onShow: (genes: string[], label: string) => void }) {
    const { focusTerm } = useComparisonActions();
    return (
      <>
        <button type="button" onClick={() => focusTerm(TERM)}>
          focus
        </button>
        <PathwayFocusBar onShowInExplorer={onShow} />
      </>
    );
  }

  const renderBar = (onShow = jest.fn()) => {
    render(
      <ComparisonSelectionProvider>
        <Harness onShow={onShow} />
      </ComparisonSelectionProvider>
    );
    return onShow;
  };

  it('shows nothing at all until a pathway is focused', () => {
    renderBar();
    expect(screen.queryByTestId('pathway-focus-bar')).toBeNull();
  });

  it('names the pathway and counts its genes', async () => {
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'focus' }));

    expect(screen.getByTestId('pathway-focus-bar')).toHaveTextContent('Apoptotic process');
    expect(screen.getByText('3 genes')).toBeInTheDocument();
  });

  // Tier 2: the only crossing between screens, and the user has to ask for it.
  it('hands the genes over only when asked', async () => {
    const onShow = renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'focus' }));

    expect(onShow).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Show these 3 genes in Explore/ }));

    expect(onShow).toHaveBeenCalledWith(TERM.genes, TERM.name);
  });

  it('can be dismissed', async () => {
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'focus' }));
    await userEvent.click(screen.getByRole('button', { name: /Stop looking through/ }));

    expect(screen.queryByTestId('pathway-focus-bar')).toBeNull();
  });

  it('offers no hand-over for a pathway with no genes', async () => {
    function Empty() {
      const { focusTerm } = useComparisonActions();
      return (
        <>
          <button type="button" onClick={() => focusTerm({ ...TERM, genes: [] })}>
            focus
          </button>
          <PathwayFocusBar onShowInExplorer={jest.fn()} />
        </>
      );
    }
    render(
      <ComparisonSelectionProvider>
        <Empty />
      </ComparisonSelectionProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'focus' }));

    expect(screen.queryByText(/Show these/)).toBeNull();
  });
});

describe('tier 2 — crossing to Explore', () => {
  it('turns the pathway into a labelled selection and drops the focus', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.actions.focusTerm(TERM));
    // What ComparisonDetail's handler does
    act(() => {
      result.current.actions.selectGenes(TERM.genes, 'pathway', TERM.name);
      result.current.actions.focusTerm(null);
    });

    expect(result.current.selection).toMatchObject({
      genes: TERM.genes,
      source: 'pathway',
      label: TERM.name,
      // A set is its own subject; no gene is arbitrarily promoted.
      focusedGene: null,
    });
    expect(result.current.term).toBeNull();
  });
});
