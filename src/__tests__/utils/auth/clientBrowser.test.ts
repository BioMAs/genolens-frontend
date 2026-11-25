/**
 * The parts of the auth client that touch the document: the readable session
 * hint cookie, sign-out and the sign-out left pending. jsdom has no `fetch` and
 * cannot be navigated, so both are faked (`navigate` is the seam over
 * `window.location.assign`).
 */
import {
  SessionExpiredError,
  confirmMfaSetup,
  hasSessionHint,
  isLogoutPending,
  isSignedOutResponse,
  redirectToSignIn,
  replayPendingLogout,
  signOut,
  verifyMfa,
} from '@/utils/auth/client';
import { LOGOUT_TIMEOUT_MS } from '@/utils/auth/constants';
import { SESSION_EXPIRED } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

const API = 'http://api.example.test/api/v1';
const initialApiUrl = process.env.NEXT_PUBLIC_API_URL;
const initialFetch = globalThis.fetch;
const fetchMock = jest.fn();

function clearCookies() {
  for (const name of ['gl_session', 'account_status', 'unrelated', 'gl_logout_pending']) {
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

const LOCAL_SIGNOUT = '/auth/local-signout';

/** The flag a sign-out the API could not take leaves behind. */
const markPending = () => {
  document.cookie = 'gl_logout_pending=1; path=/';
};

describe('signOut', () => {
  it('posts to /auth/logout, then clears the local session cookies, then reloads on the sign-in page', async () => {
    document.cookie = 'account_status=suspended; path=/';
    fetchMock.mockResolvedValueOnce(reply(204)).mockResolvedValueOnce(reply(204));

    await signOut();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/logout`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-GenoLens-Client': 'web' }),
    });
    // The web app's own server expires gl_at and gl_session: same origin, same header.
    expect(fetchMock.mock.calls[1][0]).toBe(LOCAL_SIGNOUT);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'X-GenoLens-Client': 'web' }),
    });
    expect(document.cookie).not.toContain('account_status');
    expect(isLogoutPending()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('gives the API call a deadline of LOGOUT_TIMEOUT_MS', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(reply(204));

    await signOut();

    expect(LOGOUT_TIMEOUT_MS).toBe(10_000);
    expect(spy).toHaveBeenCalledWith(LOGOUT_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBe(spy.mock.results[0].value);
    spy.mockRestore();
  });

  // The API could not take the sign-out: its session is still valid, and without more the
  // middleware would send `/` on to the dashboard. The web app's server expires the cookies
  // the pages read, a flag remembers to try again, and `/?reauth=1` says what happened.
  it.each([
    ['an unreachable API', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['an API error', () => fetchMock.mockResolvedValueOnce(reply(503, { detail: 'unavailable' }))],
  ])('clears the local session, remembers the sign-out and lands on /?reauth=1 after %s', async (_name, arrange) => {
    document.cookie = 'account_status=suspended; path=/';
    arrange();
    fetchMock.mockResolvedValueOnce(reply(204));

    await signOut();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(LOCAL_SIGNOUT);
    expect(document.cookie).not.toContain('account_status');
    expect(isLogoutPending()).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/?reauth=1');
  });

  it('still leaves the page when the local sign-out fails too', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await signOut();

    expect(isLogoutPending()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/?reauth=1');
  });

  it('forgets a sign-out left pending once one goes through', async () => {
    markPending();
    fetchMock.mockResolvedValue(reply(204));

    await signOut();

    expect(isLogoutPending()).toBe(false);
  });

  it.each([
    ['a refused logout', () => fetchMock.mockResolvedValueOnce(reply(403, { detail: 'csrf_header_missing' }))],
    ['a session that was already over', () => fetchMock.mockResolvedValueOnce(reply(401, { detail: 'invalid_token' }))],
  ])('still clears the local session and goes to the plain sign-in page after %s', async (_name, arrange) => {
    arrange();
    fetchMock.mockResolvedValueOnce(reply(204));

    await signOut();

    expect(fetchMock.mock.calls[1][0]).toBe(LOCAL_SIGNOUT);
    expect(isLogoutPending()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('a sign-out left pending', () => {
  it('is not pending by default, nor for another value', () => {
    expect(isLogoutPending()).toBe(false);
    document.cookie = 'gl_logout_pending=0; path=/';
    expect(isLogoutPending()).toBe(false);
  });

  it('is replayed against the API, and forgotten once it goes through', async () => {
    markPending();
    fetchMock.mockResolvedValueOnce(reply(204));

    expect(await replayPendingLogout()).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/logout`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-GenoLens-Client': 'web' }),
    });
    expect(isLogoutPending()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['an unreachable API', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['an API error', () => fetchMock.mockResolvedValueOnce(reply(502))],
  ])('stays pending after %s', async (_name, arrange) => {
    markPending();
    arrange();

    expect(await replayPendingLogout()).toBe(false);

    expect(isLogoutPending()).toBe(true);
  });

  it('calls nothing when no sign-out is pending', async () => {
    expect(await replayPendingLogout()).toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Replaying it later would end the session just opened, not the one left behind.
  it.each([
    ['a code at sign-in', () => verifyMfa({ code: '123456' }), reply(200, { next: 'app' })],
    ['a confirmed enrolment', () => confirmMfaSetup('123456'), reply(200, { recovery_codes: [] })],
  ])('is forgotten when %s opens a new session', async (_name, open, answer) => {
    markPending();
    fetchMock.mockResolvedValueOnce(answer);

    await open();

    expect(isLogoutPending()).toBe(false);
  });

  it('is kept when the code is refused', async () => {
    markPending();
    fetchMock.mockResolvedValueOnce(reply(401, { detail: 'invalid_code' }));

    await verifyMfa({ code: '000000' });

    expect(isLogoutPending()).toBe(true);
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
