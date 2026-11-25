'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { flushSync } from 'react-dom';

import { reloadPage } from '@/utils/auth/navigation';

/**
 * For a screen that shows a secret (an authenticator key, recovery codes).
 *
 * A browser may keep a page it leaves in its back/forward cache, frozen as it
 * was, and show it again on "Back": a secret on screen would come back with
 * it, on a shared computer too. So `forget` runs as the page is left
 * (`pagehide`), applied at once (`flushSync`: the page is frozen right after),
 * and a page that comes back from that cache (`pageshow` with `persisted`)
 * after forgetting a secret is reloaded rather than shown half-emptied.
 *
 * `holdsSecret` says whether there is anything to forget right now; while it
 * is false the screen is left as it is.
 */
export function useForgetOnPageHide(forget: () => void, holdsSecret = true): void {
  const forgot = useRef(false);

  const onPageHide = useEffectEvent(() => {
    if (!holdsSecret) return;
    forgot.current = true;
    flushSync(forget);
  });

  useEffect(() => {
    const hide = () => onPageHide();
    const show = (event: PageTransitionEvent) => {
      if (event.persisted && forgot.current) reloadPage();
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, []);
}
