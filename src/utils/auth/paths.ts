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

// Read at call time (not at import) so a test can set it; `NEXT_PUBLIC_*` is
// inlined by Next.js only for this literal `process.env.NEXT_PUBLIC_…` form.
function adminOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
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
  return admin !== null && url.origin === admin ? url.href : fallback;
}

/** The sign-in page (the root), remembering where to go afterwards. */
export function loginPath(next?: string): string {
  return next ? `/?next=${encodeURIComponent(next)}` : '/';
}

/** The route that renews the access token, then returns to `next`. */
export function refreshPath(next: string): string {
  return `/auth/refresh?next=${encodeURIComponent(next)}`;
}
