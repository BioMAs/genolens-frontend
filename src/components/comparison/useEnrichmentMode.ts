'use client';

/**
 * Over-representation or ranked GSEA, kept in the URL fragment.
 *
 * It was local state, which meant a GSEA result could not be linked — in a file whose own
 * comment states that the open view lives in the URL. The fragment is the right home: it is
 * within-screen position, it does not re-render through `useSearchParams`, and the browser
 * restores it on reload for free.
 *
 * This toggle stays exclusive, unlike the sections around it. ORA and GSEA are two mutually
 * exclusive computations of the same question, one of them behind an add-on — legitimate
 * exclusivity, not the accidental kind the eleven panes had.
 */

import { useCallback, useEffect, useState } from 'react';

export type EnrichmentMode = 'ora' | 'gsea';

/** Fragment that selects the ranked view. Rendered as an id too, so the anchor has a target. */
export const GSEA_HASH = 'gsea';

function readMode(): EnrichmentMode {
  if (typeof window === 'undefined') return 'ora';
  return window.location.hash === `#${GSEA_HASH}` ? 'gsea' : 'ora';
}

export function useEnrichmentMode(allowed: boolean): [EnrichmentMode, (mode: EnrichmentMode) => void] {
  // Read during render, so a cold `#gsea` link opens on the ranked view rather than flashing ORA.
  const [mode, setMode] = useState<EnrichmentMode>(readMode);

  // Back and forward change the fragment without a render, so listen for it.
  useEffect(() => {
    const onHashChange = () => setMode(readMode());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const select = useCallback((next: EnrichmentMode) => {
    setMode(next);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.hash = next === 'gsea' ? `#${GSEA_HASH}` : '';
    // replaceState, not a hash assignment: assigning `location.hash` pushes a history entry,
    // and switching sub-view is not a navigation.
    window.history.replaceState(null, '', url.toString());
  }, []);

  // GSEA is part of the Scientific tools add-on. A `#gsea` link from someone who has it must
  // not leave a user who does not on an empty pane.
  const effective: EnrichmentMode = mode === 'gsea' && !allowed ? 'ora' : mode;

  return [effective, select];
}
