/** @jest-environment node */
/**
 * Pre-session auth calls and the session refresh, over a faked global `fetch`.
 *
 * Node environment: it provides the real `Response`, which jsdom does not. The
 * parts that need a document (`hasSessionHint`, `signOut`) are in
 * `clientBrowser.test.ts`.
 */
import {
  acceptInvite,
  apiBaseUrl,
  authedFetch,
  authPost,
  confirmMfaSetup,
  forgotPassword,
  isSignedOut,
  login,
  refreshSession,
  resendVerification,
  resetPassword,
  signup,
  startMfaSetup,
  verifyEmail,
  verifyMfa,
} from '@/utils/auth/client';
import { REFRESH_TIMEOUT_MS } from '@/utils/auth/constants';

const API = 'http://api.example.test/api/v1';
const initialApiUrl = process.env.NEXT_PUBLIC_API_URL;
const initialFetch = globalThis.fetch;
const fetchMock = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = initialFetch;
  if (initialApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = initialApiUrl;
});

describe('apiBaseUrl', () => {
  it('drops a trailing slash', () => {
    process.env.NEXT_PUBLIC_API_URL = `${API}/`;
    expect(apiBaseUrl()).toBe(API);
  });

  it('falls back to a local default when the variable is unset', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBaseUrl()).toBe('http://localhost:8000/api/v2');
  });
});

describe('authPost', () => {
  it('posts JSON to /auth with the cookies and the client header', async () => {
    fetchMock.mockResolvedValueOnce(json({ next: 'mfa' }));

    const result = await authPost('/login', { email: 'a@example.test' });

    expect(result).toEqual({ ok: true, status: 200, data: { next: 'mfa' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth/login`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-GenoLens-Client': 'web' },
      body: '{"email":"a@example.test"}',
    });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends no body when none is given', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await authPost('/logout');

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('treats an empty success body (204) as null data', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await authPost('/verify-email', { token: 't' })).toEqual({
      ok: true,
      status: 204,
      data: null,
    });
  });

  it('returns the detail and the raw body of a refusal', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"detail":"invalid_code","attempts_left":2}', { status: 401 })
    );

    expect(await verifyMfa({ code: '123456' })).toEqual({
      ok: false,
      status: 401,
      detail: 'invalid_code',
      body: { detail: 'invalid_code', attempts_left: 2 },
    });
  });

  it('has no detail when the refusal body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));

    expect(await authPost('/login', {})).toEqual({
      ok: false,
      status: 502,
      detail: null,
      body: null,
    });
  });

  it('has no detail when the refusal detail is not a string', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: [{ loc: ['body', 'email'] }] }, 422));

    const result = await authPost('/signup', {});

    expect(result).toMatchObject({ ok: false, status: 422, detail: null });
  });

  it('reports an unreachable API as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await authPost('/login', {})).toEqual({
      ok: false,
      status: 0,
      detail: null,
      body: null,
    });
  });
});

describe('typed auth calls', () => {
  it.each([
    ['login', () => login('a@example.test', 'pw'), '/login', { email: 'a@example.test', password: 'pw' }],
    ['verifyMfa (code)', () => verifyMfa({ code: '123456' }), '/mfa/verify', { code: '123456' }],
    [
      'verifyMfa (recovery)',
      () => verifyMfa({ recovery_code: 'AAAAA-BBBBB' }),
      '/mfa/verify',
      { recovery_code: 'AAAAA-BBBBB' },
    ],
    ['startMfaSetup', () => startMfaSetup(), '/mfa/setup/start', undefined],
    ['confirmMfaSetup', () => confirmMfaSetup('123456'), '/mfa/setup/confirm', { code: '123456' }],
    [
      'signup',
      () => signup('a@example.test', 'pw', 'Ada'),
      '/signup',
      { email: 'a@example.test', password: 'pw', full_name: 'Ada' },
    ],
    [
      'signup without a name',
      () => signup('a@example.test', 'pw'),
      '/signup',
      { email: 'a@example.test', password: 'pw' },
    ],
    ['verifyEmail', () => verifyEmail('tok'), '/verify-email', { token: 'tok' }],
    [
      'resendVerification',
      () => resendVerification('a@example.test'),
      '/verify-email/resend',
      { email: 'a@example.test' },
    ],
    [
      'forgotPassword',
      () => forgotPassword('a@example.test'),
      '/password/forgot',
      { email: 'a@example.test' },
    ],
    [
      'resetPassword',
      () => resetPassword('tok', 'new-password'),
      '/password/reset',
      { token: 'tok', new_password: 'new-password' },
    ],
    [
      'acceptInvite',
      () => acceptInvite('tok', 'a-long-password'),
      '/invite/accept',
      { token: 'tok', password: 'a-long-password' },
    ],
  ])('%s posts to the matching route', async (_name, call, path, body) => {
    fetchMock.mockResolvedValueOnce(json({}));

    await call();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth${path}`);
    expect(init.method).toBe('POST');
    expect(init.body === undefined ? undefined : JSON.parse(init.body)).toEqual(body);
  });
});

describe('refreshSession', () => {
  it('shares one refresh between concurrent callers', async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);

    const calls = [refreshSession(), refreshSession(), refreshSession()];
    pending.resolve(new Response('{"refreshed":true}', { status: 200 }));

    expect(await Promise.all(calls)).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/refresh`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-GenoLens-Client': 'web' }),
    });
  });

  it('asks again once the previous refresh has settled', async () => {
    fetchMock.mockImplementation(async () => json({ refreshed: true }));

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a refused or unreachable refresh as false', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"invalid_refresh"}', { status: 401 }));
    expect(await refreshSession()).toBe(false);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await refreshSession()).toBe(false);

    fetchMock.mockResolvedValueOnce(json({ detail: 'too_many_attempts' }, 429));
    expect(await refreshSession()).toBe(false);
  });

  // A black-holed API would otherwise leave "Restoring your session..." spinning for ever.
  describe('when the API never answers', () => {
    afterEach(() => jest.restoreAllMocks());

    it('gives the call a deadline of REFRESH_TIMEOUT_MS', async () => {
      const spy = jest.spyOn(AbortSignal, 'timeout');
      fetchMock.mockImplementation(async () => json({ refreshed: true }));

      await refreshSession();

      expect(REFRESH_TIMEOUT_MS).toBe(10_000);
      expect(spy).toHaveBeenCalledWith(REFRESH_TIMEOUT_MS);
      const { signal } = fetchMock.mock.calls[0][1];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal).toBe(spy.mock.results[0].value);
    });

    it('reports the call as false once the deadline aborts it', async () => {
      const deadline = new AbortController();
      jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
      // A fetch that hangs until aborted, like the real one.
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation timed out.', 'TimeoutError')),
            );
          }),
      );

      const pending = refreshSession();
      deadline.abort();

      expect(await pending).toBe(false);
    });

    it('can refresh again afterwards', async () => {
      fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
      expect(await refreshSession()).toBe(false);

      fetchMock.mockResolvedValueOnce(json({ refreshed: true }));
      expect(await refreshSession()).toBe(true);
    });
  });

  it('recovers after a failed refresh', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ refreshed: true }));

    expect(await refreshSession()).toBe(false);
    expect(await refreshSession()).toBe(true);
  });
});

describe('isSignedOut', () => {
  it.each([
    [401, 'invalid_token', true],
    [401, 'not_authenticated', true],
    [401, undefined, true],
    [403, 'Not authenticated', true],
    [403, 'csrf_header_missing', false],
    [403, { error: 'account_inactive', status: 'suspended' }, false],
    [403, undefined, false],
    [400, 'invalid_password', false],
    [404, 'Not authenticated', false],
    [500, undefined, false],
    [0, undefined, false],
  ])('status %s with detail %j gives %s', (status, detail, expected) => {
    expect(isSignedOut(status, detail)).toBe(expected);
  });
});

describe('authedFetch', () => {
  const URL = 'http://api.example.test/chat';

  it('sends the cookies and the client header on top of the caller headers', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await authedFetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"q":1}',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: '{"q":1}' });
    const headers = new Headers(init.headers);
    expect(headers.get('X-GenoLens-Client')).toBe('web');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('does not refresh a successful call', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    expect((await authedFetch(URL)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes then replays once', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"detail":"not_authenticated"}', { status: 401 })) // the call
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // /refresh
      .mockResolvedValueOnce(new Response('data: x\n\n', { status: 200 })); // replay

    const response = await authedFetch(URL, { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('data: x\n\n');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/auth/refresh`);
    expect(fetchMock.mock.calls[2][0]).toBe(URL);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('treats the pre-launch 403 "Not authenticated" as signed out', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ detail: 'Not authenticated' }, 403))
      .mockResolvedValueOnce(json({ refreshed: true }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    expect((await authedFetch(URL)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['csrf_header_missing', { detail: 'csrf_header_missing' }],
    ['account_inactive', { detail: { error: 'account_inactive', status: 'suspended' } }],
  ])('never refreshes on a 403 %s', async (_name, body) => {
    fetchMock.mockResolvedValueOnce(json(body, 403));

    const response = await authedFetch(URL, { method: 'POST' });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hands back the original response, body intact, when the refresh is refused', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"detail":"invalid_token"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"detail":"invalid_refresh"}', { status: 401 }));

    const response = await authedFetch(URL);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: 'invalid_token' });
    expect(fetchMock).toHaveBeenCalledTimes(2); // the call and the refresh, no replay
  });

  it('replays only once when the replay is refused too', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"detail":"invalid_token"}', { status: 401 }))
      .mockResolvedValueOnce(json({ refreshed: true }))
      .mockResolvedValueOnce(new Response('{"detail":"invalid_token"}', { status: 401 }));

    expect((await authedFetch(URL)).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lets a network error through to the caller', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(authedFetch(URL)).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
