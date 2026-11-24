/** @jest-environment node */
/**
 * Reading the session on the Next server: the `gl_at` cookie is verified
 * locally, the profile comes from `/users/me` with that token as a Bearer.
 *
 * `next/headers`, the token check and `fetch` are simulated. Node environment:
 * it provides the real `Response`, which jsdom does not.
 */
import { getServerUser, getSessionUser } from '@/utils/auth/server';
import { verifyAccessToken } from '@/utils/auth/jwt';
import { installFakeFetch } from '@/test-utils/fetchDoubles';

const cookieJar = new Map<string, string>();

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

jest.mock('@/utils/auth/jwt', () => ({ verifyAccessToken: jest.fn() }));

const verify = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const fetchMock = installFakeFetch('http://api.example.test/api/v1');

const CLAIMS = { sub: 'u1', sid: 's1', amr: ['pwd', 'otp'] };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

// The server's only log channel. Silenced for the file, and what each test
// expects of it is asserted: a signed-out visitor must stay quiet, a failure of
// the API must not.
let logged: jest.SpyInstance;

beforeEach(() => {
  cookieJar.clear();
  verify.mockReset();
  logged = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe('getSessionUser', () => {
  it('has no session without an access cookie, and does not verify anything', async () => {
    expect(await getSessionUser()).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it('returns the claims of a token that verifies', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);

    expect(await getSessionUser()).toEqual(CLAIMS);
    expect(verify).toHaveBeenCalledWith('tok');
  });

  it('has no session when the token does not verify', async () => {
    cookieJar.set('gl_at', 'forged');
    verify.mockResolvedValue(null);

    expect(await getSessionUser()).toBeNull();
  });
});

describe('getServerUser', () => {
  it('has no user without an access cookie, and does not call the API', async () => {
    expect(await getServerUser()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the API for a token that does not verify', async () => {
    cookieJar.set('gl_at', 'forged');
    verify.mockResolvedValue(null);

    expect(await getServerUser()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads /users/me with the access token as Bearer', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(
      json(200, { id: 'u1', email: 'a@example.test', full_name: null, role: 'ADMIN' }),
    );

    expect(await getServerUser()).toEqual({
      id: 'u1',
      email: 'a@example.test',
      full_name: null,
      role: 'ADMIN',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.example.test/api/v1/users/me');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.cache).toBe('no-store');
  });

  it('keeps only what the shell needs of the profile', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(
      json(200, {
        id: 'u1',
        email: 'a@example.test',
        full_name: 'Ada Example',
        role: 'USER',
        subscription_plan: 'TEAM',
        mfa_enabled: true,
      }),
    );

    expect(await getServerUser()).toEqual({
      id: 'u1',
      email: 'a@example.test',
      full_name: 'Ada Example',
      role: 'USER',
    });
  });

  it('treats a revoked session as signed out', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(json(401, { detail: 'invalid_token' }));

    expect(await getServerUser()).toBeNull();
    expect(logged).not.toHaveBeenCalled();
  });

  it('treats an inactive account as signed out', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(
      json(403, { detail: { error: 'account_inactive', status: 'suspended' } }),
    );

    expect(await getServerUser()).toBeNull();
    expect(logged).not.toHaveBeenCalled();
  });

  it('hands fetch a time limit, so a black-holed API cannot hold every render', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(json(401, { detail: 'invalid_token' }));

    await getServerUser();

    const { signal } = fetchMock.mock.calls[0][1];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  describe('when the API fails rather than refuses', () => {
    beforeEach(() => {
      cookieJar.set('gl_at', 'secret-token-value');
      verify.mockResolvedValue(CLAIMS);
    });

    it.each([429, 500, 502, 503])(
      'is signed out, and logged, on a %i (an outage must not pass for anonymous traffic)',
      async (status) => {
        fetchMock.mockResolvedValue(json(status, { detail: 'oops' }));

        expect(await getServerUser()).toBeNull();
        expect(logged).toHaveBeenCalledTimes(1);
        expect(String(logged.mock.calls[0][0])).toContain(String(status));
      },
    );

    it('is signed out, and logged, when the API is unreachable', async () => {
      const failure = new TypeError('fetch failed');
      fetchMock.mockRejectedValue(failure);

      expect(await getServerUser()).toBeNull();
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged.mock.calls[0]).toContain(failure);
    });

    it('is signed out, and logged, when the time limit expires', async () => {
      const expired = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      fetchMock.mockRejectedValue(expired);

      expect(await getServerUser()).toBeNull();
      expect(logged).toHaveBeenCalledTimes(1);
    });

    it('is signed out, and logged, on an answer that is not the profile', async () => {
      fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 200 }));

      expect(await getServerUser()).toBeNull();
      expect(logged).toHaveBeenCalledTimes(1);
    });

    it('never writes the access token to the log', async () => {
      fetchMock.mockResolvedValue(json(500, { detail: 'oops' }));
      await getServerUser();
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await getServerUser();

      expect(logged).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(logged.mock.calls)).not.toContain('secret-token-value');
    });
  });
});
