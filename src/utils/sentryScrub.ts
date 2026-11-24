/**
 * Keeps the one-time token of an e-mailed link (`/auth/reset?token=…`,
 * `/auth/invite?token=…`, `/auth/verify-email?token=…`) out of Sentry.
 *
 * `useLinkToken` takes the token out of the address bar once the page has
 * mounted, but a pageload transaction, an error raised on the way in and the
 * breadcrumbs have by then recorded `location.href`. The token is a credential
 * until it is used, so every event, transaction and breadcrumb is scrubbed
 * before it leaves the browser (or the server that rendered the page).
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

/** The query string without its `token` pairs, or `null` when it had none (nothing to rewrite). */
function withoutTokenPairs(query: string): string | null {
  const pairs = query.split('&');
  const kept = pairs.filter((pair) => !isTokenKey(pair.split('=')[0]));
  return kept.length === pairs.length ? null : kept.join('&');
}

/**
 * The URL without its `token` query parameter. Works on absolute and relative
 * URLs, keeps every other parameter and the fragment as written, and returns
 * the string untouched when there is no such parameter.
 */
export function scrubTokenParam(url: string): string {
  const queryAt = url.indexOf('?');
  const hashAt = url.indexOf('#');
  // No query, or a `?` that sits inside the fragment.
  if (queryAt === -1 || (hashAt !== -1 && hashAt < queryAt)) return url;

  const end = hashAt === -1 ? url.length : hashAt;
  const query = withoutTokenPairs(url.slice(queryAt + 1, end));
  if (query === null) return url;
  return url.slice(0, queryAt) + (query ? `?${query}` : '') + url.slice(end);
}

/** A value held under a key such as `query_string`, `http.query` or `url.query`. */
function scrubQuery(value: unknown): unknown {
  if (typeof value === 'string') {
    const lead = value.startsWith('?') ? '?' : '';
    const query = withoutTokenPairs(value.slice(lead.length));
    return query === null ? value : lead + query;
  }
  // `[['token', 'x'], ['a', '1']]`, one of the shapes Sentry accepts.
  if (Array.isArray(value)) {
    return value.filter((pair) => !(Array.isArray(pair) && typeof pair[0] === 'string' && isTokenKey(pair[0])));
  }
  return value;
}

const isQueryKey = (key: string) => key === 'query_string' || /query$/i.test(key);

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
 * A copy of a Sentry event, transaction or breadcrumb with the `token` query
 * parameter removed from every URL it holds: `request.url`, the query string,
 * the referrer, the transaction name, tags, span descriptions, navigation
 * breadcrumbs (`from`, `to`), fetch breadcrumbs (`url`). The input is not changed.
 */
export function scrubTokens<T>(value: T): T {
  return scrubValue(value, 0) as T;
}
