/**
 * The token of an e-mailed link must not reach Sentry: `useLinkToken` cleans the
 * address bar after mount, but the pageload transaction, an early error and the
 * breadcrumbs have already recorded the full URL.
 */
import { scrubTokenParam, scrubTokens } from '@/utils/sentryScrub';

const SECRET = 'tok_9f2c-secret-value';

describe('scrubTokenParam', () => {
  it.each([
    [`https://app.example.test/auth/reset?token=${SECRET}`, 'https://app.example.test/auth/reset'],
    [`/auth/invite?token=${SECRET}`, '/auth/invite'],
    [`/auth/reset?a=1&token=${SECRET}&b=2`, '/auth/reset?a=1&b=2'],
    [`/auth/reset?token=${SECRET}&b=2`, '/auth/reset?b=2'],
    [`/auth/reset?a=1&token=${SECRET}`, '/auth/reset?a=1'],
    [`/auth/reset?token=${SECRET}#top`, '/auth/reset#top'],
    [`/auth/reset?a=1&token=${SECRET}#top`, '/auth/reset?a=1#top'],
    // Both spellings of the key, and a repeated one.
    [`/auth/reset?%74oken=${SECRET}`, '/auth/reset'],
    [`/auth/reset?Token=${SECRET}&token=${SECRET}`, '/auth/reset'],
    // A valueless key is dropped too.
    ['/auth/reset?token', '/auth/reset'],
    // In the fragment, where links carry it now.
    [`https://app.example.test/auth/reset#token=${SECRET}`, 'https://app.example.test/auth/reset'],
    [`/auth/invite#token=${SECRET}`, '/auth/invite'],
    [`/auth/reset#a=1&token=${SECRET}`, '/auth/reset#a=1'],
    [`/auth/reset#token=${SECRET}&b=2`, '/auth/reset#b=2'],
    [`/auth/reset?a=1#token=${SECRET}`, '/auth/reset?a=1'],
    [`/auth/reset?token=${SECRET}#token=${SECRET}`, '/auth/reset'],
    [`/auth/reset#%74oken=${SECRET}`, '/auth/reset'],
    // `location.hash` on its own.
    [`#token=${SECRET}`, ''],
  ])('strips the token from %s', (input, expected) => {
    const result = scrubTokenParam(input);

    expect(result).toBe(expected);
    expect(result).not.toContain(SECRET);
  });

  it.each([
    'https://app.example.test/dashboard',
    '/projects/p1?tab=2',
    '/auth/reset?tokens=2&mytoken=1&token_type=a',
    '/auth/forgot?',
    '',
    'GET /auth/reset',
    '/auth/reset#top',
    '/auth/reset#tokens=2&mytoken=1',
    '/projects/p1?tab=2#',
  ])('leaves %s as it is', (input) => {
    expect(scrubTokenParam(input)).toBe(input);
  });

  it('keeps every other parameter as written, encoding included', () => {
    expect(scrubTokenParam(`/x?next=%2Fprojects%3Ftab%3D2&token=${SECRET}&q=a+b`)).toBe(
      '/x?next=%2Fprojects%3Ftab%3D2&q=a+b',
    );
  });

  it('copes with a malformed escape in a key', () => {
    expect(scrubTokenParam(`/x?%E0%A4%A=1&token=${SECRET}`)).toBe('/x?%E0%A4%A=1');
  });
});

describe('scrubTokens', () => {
  const URL_WITH_TOKEN = `https://app.example.test/auth/reset?token=${SECRET}`;
  const URL_CLEAN = 'https://app.example.test/auth/reset';

  /** No copy of the secret anywhere in the serialised result. */
  const expectClean = (value: unknown) => expect(JSON.stringify(value)).not.toContain(SECRET);

  it('cleans a pageload transaction: request, name, tags, trace data and spans', () => {
    const transaction = {
      type: 'transaction',
      transaction: `/auth/reset?token=${SECRET}`,
      request: {
        url: URL_WITH_TOKEN,
        headers: { Referer: URL_WITH_TOKEN, 'User-Agent': 'test' },
        query_string: `token=${SECRET}`,
      },
      tags: { url: URL_WITH_TOKEN, release: '1.2.3' },
      contexts: { trace: { op: 'pageload', data: { url: URL_WITH_TOKEN, 'http.query': `?token=${SECRET}` } } },
      spans: [{ description: `GET ${URL_WITH_TOKEN}`, data: { 'http.url': URL_WITH_TOKEN } }],
    };

    const result = scrubTokens(transaction);

    expectClean(result);
    expect(result.request.url).toBe(URL_CLEAN);
    expect(result.request.headers.Referer).toBe(URL_CLEAN);
    expect(result.request.headers['User-Agent']).toBe('test');
    expect(result.transaction).toBe('/auth/reset');
    expect(result.tags).toEqual({ url: URL_CLEAN, release: '1.2.3' });
    expect(result.request.query_string).toBe('');
    expect(result.contexts.trace.data['http.query']).toBe('?');
    expect(result.spans[0].description).toBe(`GET ${URL_CLEAN}`);
  });

  it('cleans an error event, whatever shape its query string has', () => {
    const asString = scrubTokens({ request: { url: URL_WITH_TOKEN, query_string: `a=1&token=${SECRET}` } });
    const asObject = scrubTokens({ request: { query_string: { token: SECRET, a: '1' } } });
    const asPairs = scrubTokens({
      request: {
        query_string: [
          ['token', SECRET],
          ['a', '1'],
        ],
      },
    });

    for (const result of [asString, asObject, asPairs]) expectClean(result);
    expect(asString.request.query_string).toBe('a=1');
    expect(asObject.request.query_string).toEqual({ a: '1' });
    expect(asPairs.request.query_string).toEqual([['a', '1']]);
  });

  it('cleans the exception message and the breadcrumbs', () => {
    const event = {
      exception: { values: [{ type: 'Error', value: `Failed to load ${URL_WITH_TOKEN}` }] },
      breadcrumbs: [
        { category: 'navigation', data: { from: URL_WITH_TOKEN, to: '/dashboard' } },
        { category: 'navigation', data: { from: '/', to: URL_WITH_TOKEN } },
        { category: 'fetch', data: { url: `/api/x?token=${SECRET}&a=1`, method: 'GET' } },
      ],
    };

    const result = scrubTokens(event);

    expectClean(result);
    expect(result.breadcrumbs[0].data).toEqual({ from: URL_CLEAN, to: '/dashboard' });
    expect(result.breadcrumbs[1].data).toEqual({ from: '/', to: URL_CLEAN });
    expect(result.breadcrumbs[2].data).toEqual({ url: '/api/x?a=1', method: 'GET' });
  });

  it('cleans a link whose token rides in the fragment', () => {
    const inFragment = `https://app.example.test/auth/reset#token=${SECRET}`;
    const transaction = {
      type: 'transaction',
      request: { url: inFragment },
      contexts: {
        trace: { data: { url: inFragment, 'http.fragment': `#token=${SECRET}`, 'url.fragment': `token=${SECRET}` } },
      },
      // What `useLinkToken` leaves behind when it cleans the address bar.
      breadcrumbs: [{ category: 'navigation', data: { from: '/auth/reset#token=' + SECRET, to: '/auth/reset' } }],
    };

    const result = scrubTokens(transaction);

    expectClean(result);
    expect(result.request.url).toBe(URL_CLEAN);
    expect(result.contexts.trace.data).toEqual({ url: URL_CLEAN, 'http.fragment': '#', 'url.fragment': '' });
    expect(result.breadcrumbs[0].data).toEqual({ from: '/auth/reset', to: '/auth/reset' });
  });

  it('cleans a single breadcrumb, as beforeBreadcrumb hands it over', () => {
    const breadcrumb = { category: 'navigation', data: { from: '/', to: `/auth/invite?token=${SECRET}` } };

    expect(scrubTokens(breadcrumb)).toEqual({
      category: 'navigation',
      data: { from: '/', to: '/auth/invite' },
    });
  });

  it('does not change its input', () => {
    const event = { request: { url: URL_WITH_TOKEN }, list: [URL_WITH_TOKEN] };
    const snapshot = JSON.stringify(event);

    scrubTokens(event);

    expect(JSON.stringify(event)).toBe(snapshot);
  });

  it('leaves an event without a token as it was', () => {
    const event = {
      message: 'Something broke',
      level: 'error',
      request: { url: 'https://app.example.test/projects/p1?tab=2' },
      timestamp: 1700000000,
      extra: { count: 3, ok: true, nothing: null },
    };

    expect(scrubTokens(event)).toEqual(event);
  });

  it('keeps what is not plain data as it is', () => {
    const when = new Date(0);

    const result = scrubTokens({ when });

    expect(result.when).toBe(when);
  });

  it('passes null and primitives through', () => {
    expect(scrubTokens(null)).toBeNull();
    expect(scrubTokens(undefined)).toBeUndefined();
    expect(scrubTokens(42)).toBe(42);
  });
});
