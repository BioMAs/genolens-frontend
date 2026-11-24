/**
 * The parts of the auth client that touch the document: the readable session
 * hint cookie and sign-out. jsdom has no `fetch` and cannot be navigated, so
 * both are faked (`navigate` is the seam over `window.location.assign`).
 */
import {
  SessionExpiredError,
  hasSessionHint,
  isSignedOutResponse,
  redirectToSignIn,
  signOut,
} from '@/utils/auth/client';
import { SESSION_EXPIRED } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

const API = 'http://api.example.test/api/v1';
const initialApiUrl = process.env.NEXT_PUBLIC_API_URL;
const initialFetch = globalThis.fetch;
const fetchMock = jest.fn();

function clearCookies() {
  for (const name of ['gl_session', 'account_status', 'unrelated']) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

/** The one thing `authPost` reads from a response, without `Response` (absent in jsdom). */
function reply(status: number, body: unknown = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === null ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  } as unknown as Response;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
  fetchMock.mockReset();
  (navigate as jest.Mock).mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  clearCookies();
});

afterAll(() => {
  clearCookies();
  globalThis.fetch = initialFetch;
  if (initialApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = initialApiUrl;
});

describe('hasSessionHint', () => {
  it('is false without the cookie', () => {
    expect(hasSessionHint()).toBe(false);
  });

  it('is true once gl_session=1 is set, among other cookies', () => {
    document.cookie = 'unrelated=x; path=/';
    document.cookie = 'gl_session=1; path=/';

    expect(hasSessionHint()).toBe(true);
  });

  it('ignores another value and a look-alike name', () => {
    document.cookie = 'gl_session=0; path=/';
    expect(hasSessionHint()).toBe(false);

    document.cookie = 'gl_session=; path=/; max-age=0';
    document.cookie = 'not_gl_session=1; path=/';
    expect(hasSessionHint()).toBe(false);
  });
});

describe('signOut', () => {
  it('posts to /auth/logout, clears account_status, then reloads on the sign-in page', async () => {
    document.cookie = 'account_status=suspended; path=/';
    fetchMock.mockResolvedValueOnce(reply(204));

    await signOut();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/logout`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-GenoLens-Client': 'web' }),
    });
    expect(document.cookie).not.toContain('account_status');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  // The API could not take the sign-out, so the cookies are still in place and the
  // middleware would send `/` on to the dashboard: the user would never see that
  // they are not signed out. `/?reauth=1` (no `next`) is served as the form.
  it.each([
    ['an unreachable API', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['an API error', () => fetchMock.mockResolvedValueOnce(reply(503, { detail: 'unavailable' }))],
  ])('lands on the sign-in form, marked reauth, after %s', async (_name, arrange) => {
    document.cookie = 'account_status=suspended; path=/';
    arrange();

    await signOut();

    expect(document.cookie).not.toContain('account_status');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/?reauth=1');
  });

  it.each([
    ['a refused logout', () => fetchMock.mockResolvedValueOnce(reply(403, { detail: 'csrf_header_missing' }))],
    ['a session that was already over', () => fetchMock.mockResolvedValueOnce(reply(401, { detail: 'invalid_token' }))],
  ])('still goes to the plain sign-in page after %s', async (_name, arrange) => {
    arrange();

    await signOut();

    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('redirectToSignIn', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  it('sends the visitor to sign in, remembering the page', () => {
    window.history.pushState({}, '', '/projects/p1?tab=2');

    redirectToSignIn();

    expect(navigate).toHaveBeenCalledWith('/?next=%2Fprojects%2Fp1%3Ftab%3D2');
  });

  it('stays put on a public page, where there is nothing to be sent back from', () => {
    window.history.pushState({}, '', '/pricing');

    redirectToSignIn();

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('SessionExpiredError', () => {
  it('carries the sentence the visitor reads', () => {
    const error = new SessionExpiredError();

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(SESSION_EXPIRED);
    expect(error.message).toBe('Your session has expired. Sign in again to continue.');
  });
});

describe('isSignedOutResponse', () => {
  const answer = (status: number, body: string) =>
    ({ status, clone: () => ({ json: () => Promise.resolve(JSON.parse(body)) }) }) as unknown as Response;

  it('recognises a 401, and the pre-launch 403 "Not authenticated"', async () => {
    expect(await isSignedOutResponse(answer(401, '{}'))).toBe(true);
    expect(await isSignedOutResponse(answer(403, '{"detail":"Not authenticated"}'))).toBe(true);
  });

  it('does not take any other refusal for a sign-out', async () => {
    expect(await isSignedOutResponse(answer(403, '{"detail":"csrf_header_missing"}'))).toBe(false);
    expect(await isSignedOutResponse(answer(403, 'not json'))).toBe(false);
    expect(await isSignedOutResponse(answer(500, '{}'))).toBe(false);
  });
});
