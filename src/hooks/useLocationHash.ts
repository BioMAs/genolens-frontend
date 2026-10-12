'use client';

import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}

/**
 * The URL fragment, readable during render without a hydration mismatch.
 *
 * Reading `window.location.hash` straight in render paints one thing on the server (no window)
 * and another on the client. `useSyncExternalStore` renders the server snapshot during hydration
 * and re-renders with the real one right after, which is what React expects.
 *
 * Only `hashchange` notifies. A `replaceState` that rewrites the fragment is picked up on the next
 * render, since the snapshot is read on every render — enough for the comparison page, which
 * re-renders through `useSearchParams` whenever it rewrites its own URL.
 */
export function useLocationHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => ''
  );
}
