'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The token of an e-mailed link (`/auth/reset#token=…`), read once.
 *
 * Links carry it in the fragment: a browser never sends the fragment to a
 * server, so the token stays out of access logs and out of `Referer`. Links
 * sent before that carry it in the query string (`/auth/reset?token=…`) and
 * are still read; the fragment wins when both are there.
 *
 * It is taken out of the address bar as soon as it is read: a token left in the
 * URL would stay in the history, in a bookmark, and in whatever the visitor
 * copies from the bar.
 *
 * `undefined` until the page has mounted (the URL does not exist on the
 * server, and a first render that said "no token" would flash an error), then
 * the token, or `null` when the link carries none.
 */
export function useLinkToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  // StrictMode runs the effect twice on the same instance. The second run
  // would find the URL already cleaned and overwrite the token with `null`.
  const read = useRef(false);

  useEffect(() => {
    if (read.current) return;
    read.current = true;

    const found =
      new URLSearchParams(window.location.hash.slice(1)).get('token') ||
      new URLSearchParams(window.location.search).get('token') ||
      null;
    // The path alone: both the query string and the fragment go.
    if (found !== null) window.history.replaceState(null, '', window.location.pathname);
    // Reading the URL is the whole point of this effect: the server has none, and
    // the token must be kept once the bar is cleaned, so it cannot be derived on render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(found);
  }, []);

  return token;
}
