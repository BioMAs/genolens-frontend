/**
 * Keeps the one-time token of an e-mailed link (`/auth/reset#token=…`,
 * `/auth/invite#token=…`, `/auth/verify-email#token=…`, or `?token=…` in links
 * sent before the token moved to the fragment) out of Sentry.
 *
 * `useLinkToken` takes the token out of the address bar once the page has
 * mounted, but a pageload transaction, an error raised on the way in and the
 * breadcrumbs have by then recorded `location.href`, fragment included. The
 * token is a credential until it is used, so every event, transaction and
 * breadcrumb is scrubbed before it leaves the browser (or the server that
 * rendered the page).
 *
 * Pure and framework-free: the three Sentry configs hand it to `beforeSend`,
 * `beforeSendTransaction` and `beforeBreadcrumb`.
 */

const TOKEN_PARAM = 'token';
// Events are shallow, but a span or a breadcrumb can nest a few levels.
const MAX_DEPTH = 8;

function isTokenKey(raw: string): boolean {
  let key = raw;
  try {
    key = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    // A malformed escape: compare the key as written.
  }
  return key.toLowerCase() === TOKEN_PARAM;
}

/**
 * A query string or a fragment without its `token` pairs, or `null` when it
 * had none (nothing to rewrite).
 */
function withoutTokenPairs(query: string): string | null {
  const pairs = query.split('&');
  const kept = pairs.filter((pair) => !isTokenKey(pair.split('=')[0]));
  return kept.length === pairs.length ? null : kept.join('&');
}

/** What comes before the fragment, without the `token` pairs of its query string. */
function scrubBeforeFragment(head: string): string {
  const queryAt = head.indexOf('?');
  if (queryAt === -1) return head;
  const query = withoutTokenPairs(head.slice(queryAt + 1));
  if (query === null) return head;
  return head.slice(0, queryAt) + (query ? `?${query}` : '');
}

/** A fragment (`#…`) without its `token` pairs, dropped altogether when nothing else is left. */
function scrubFragment(hash: string): string {
  const fragment = withoutTokenPairs(hash.slice(1));
  if (fragment === null) return hash;
  return fragment ? `#${fragment}` : '';
}

/**
 * The URL without its `token` parameter, in the query string and in the
 * fragment. Works on absolute and relative URLs, keeps every other parameter
 * and fragment as written, and returns the string untouched when there is no
 * such parameter.
 */
export function scrubTokenParam(url: string): string {
  const hashAt = url.indexOf('#');
  if (hashAt === -1) return scrubBeforeFragment(url);
  return scrubBeforeFragment(url.slice(0, hashAt)) + scrubFragment(url.slice(hashAt));
}

/**
 * A value held under a key such as `query_string`, `http.query`, `url.query`
 * or `http.fragment`.
 */
function scrubQuery(value: unknown): unknown {
  if (typeof value === 'string') {
    const lead = value.startsWith('?') || value.startsWith('#') ? value[0] : '';
    const query = withoutTokenPairs(value.slice(lead.length));
    return query === null ? value : lead + query;
  }
  // `[['token', 'x'], ['a', '1']]`, one of the shapes Sentry accepts.
  if (Array.isArray(value)) {
    return value.filter((pair) => !(Array.isArray(pair) && typeof pair[0] === 'string' && isTokenKey(pair[0])));
  }
  return value;
}

const isQueryKey = (key: string) => key === 'query_string' || /(query|fragment)$/i.test(key);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubTokenParam(value);
  if (depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (!isPlainObject(value)) return value;

  const copy: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    // A `token` entry of a query given as an object (`query_string: { token: … }`).
    if (isTokenKey(key) && typeof inner === 'string') continue;
    copy[key] = isQueryKey(key) ? scrubValue(scrubQuery(inner), depth + 1) : scrubValue(inner, depth + 1);
  }
  return copy;
}

/**
 * A copy of a Sentry event, transaction or breadcrumb with the `token`
 * parameter removed from every URL it holds, query string and fragment alike:
 * `request.url`, the query string, the referrer, the transaction name, tags,
 * span descriptions and data, navigation breadcrumbs (`from`, `to`), fetch
 * breadcrumbs (`url`). The input is not changed.
 */
export function scrubTokens<T>(value: T): T {
  return scrubValue(value, 0) as T;
}
