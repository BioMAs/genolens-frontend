'use client';

import { useCallback, useEffect, useRef } from 'react';
import { scrollToId } from '@/utils/scrollToId';

/**
 * Ask for a scroll to an anchor that may not exist yet.
 *
 * Two things make a plain `scrollIntoView` at click time wrong on the comparison screen:
 *
 * 1. The screen is switched with `history.replaceState`, which writes a hash and never scrolls —
 *    anchors move the page on a real navigation only. A `<a href="#genes">` works; a button
 *    setting the same hash does not, which is why the section rail jumped and the module cards
 *    silently did nothing.
 * 2. Crossing to another screen mounts the target one render later, so at the moment of the
 *    click the node genuinely is not there.
 *
 * So a request scrolls at once when it can, and is otherwise held and retried when new anchors
 * may have appeared. `retryKey` is whatever marks that moment — the open screen, here.
 *
 * The pending target is a ref, not state: it is never read during render, and holding it in
 * state would mean clearing it from inside the effect, which is a cascading render for nothing.
 *
 * A request for an anchor that never mounts simply scrolls nothing. That is not an error state,
 * and the next request replaces it.
 */
export function useDeferredAnchorScroll(retryKey: unknown) {
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (pending.current === null) return;
    if (scrollToId(pending.current)) pending.current = null;
  }, [retryKey]);

  return useCallback((id: string) => {
    // Same screen: the section is already mounted, so do not wait a render to move.
    if (scrollToId(id)) {
      pending.current = null;
      return;
    }
    pending.current = id;
  }, []);
}
