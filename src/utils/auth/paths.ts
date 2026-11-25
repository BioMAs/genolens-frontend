import { DEFAULT_AFTER_LOGIN } from './constants';

/** Pages reachable without a session. `/plotly-check` and `/cosmomics-check` are lab pages used without a backend. */
const PUBLIC_PAGES = new Set([
  '/',
  '/login',
  '/pricing',
  '/suspended',
  '/plotly-check',
  '/cosmomics-check',
]);
const PUBLIC_PREFIXES = ['/auth/', '/api/'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Browsers strip tabs and line breaks from a URL, which would turn `/\t/x`
// into the protocol-relative `//x`; any control character is refused.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// Only a real web origin can be trusted: `new URL(...).origin` is the opaque
// string "null" for every non-special scheme (`javascript:`, `data:`, and a
// scheme-less `localhost:3001`, which parses as scheme "localhost:"), so
// comparing origins without checking the scheme would equate them all.
function isWebUrl(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Read at call time (not at import) so a test can set it; `NEXT_PUBLIC_*` is
// inlined by Next.js only for this literal `process.env.NEXT_PUBLIC_…` form.
// A misconfigured value (not http(s)) yields no admin origin at all.
function adminOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return isWebUrl(url) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Validates a post-login destination taken from the query string.
 *
 * Accepts a same-site path (`/projects/p1?tab=2`) or an absolute URL on the
 * admin app's origin; anything else yields `fallback`. The value arrives
 * already decoded by `URLSearchParams`, so nothing is decoded here. The result
 * can be handed as is to `window.location.assign` or `new URL(next, request.url)`.
 */
export function safeNext(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (!raw || CONTROL_CHARACTERS.test(raw) || raw.includes('\\')) return fallback;

  if (raw.startsWith('/')) return raw.startsWith('//') ? fallback : raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fallback;
  }
  const admin = adminOrigin();
  return admin !== null && isWebUrl(url) && url.origin === admin ? url.href : fallback;
}

/** The sign-in page (the root), remembering where to go afterwards. */
export function loginPath(next?: string): string {
  return next ? `/?next=${encodeURIComponent(next)}` : '/';
}

/**
 * The sign-in page after a renewal that failed or must not be retried. `reauth=1`
 * tells the middleware to show the form instead of sending `/` back to
 * `/auth/refresh`. Built with `URLSearchParams` so it stays well-formed
 * whether or not there is a `next`.
 */
export function reauthLoginPath(next: string): string {
  const params = new URLSearchParams();
  if (next) params.set('next', next);
  params.set('reauth', '1');
  return `/?${params.toString()}`;
}

/** The route that renews the access token, then returns to `next`. */
export function refreshPath(next: string): string {
  return `/auth/refresh?next=${encodeURIComponent(next)}`;
}
