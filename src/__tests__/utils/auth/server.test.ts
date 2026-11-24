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

beforeEach(() => {
  cookieJar.clear();
  verify.mockReset();
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
  });

  it('treats an inactive account as signed out', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockResolvedValue(
      json(403, { detail: { error: 'account_inactive', status: 'suspended' } }),
    );

    expect(await getServerUser()).toBeNull();
  });

  it('does not take the whole app down when the API is unreachable', async () => {
    cookieJar.set('gl_at', 'tok');
    verify.mockResolvedValue(CLAIMS);
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect(await getServerUser()).toBeNull();
  });
});
