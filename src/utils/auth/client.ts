import {
  CLIENT_HEADER,
  CLIENT_NAME,
  LOCAL_SIGNOUT_PATH,
  LOGOUT_PENDING_COOKIE,
  LOGOUT_PENDING_MAX_AGE_SECONDS,
  LOGOUT_TIMEOUT_MS,
  REFRESH_TIMEOUT_MS,
  SESSION_HINT_COOKIE,
} from './constants';
import { SESSION_EXPIRED } from './messages';
import { navigate } from './navigation';
import { isPublicPath, loginPath } from './paths';

/**
 * Browser transport for the self-hosted auth API: calls made before a session
 * exists (login, MFA, sign-up, recovery) and the session refresh. The session
 * itself lives in httpOnly cookies the API sets: nothing here ever reads or
 * sends a token, every call carries the cookies (`credentials: 'include'`) and
 * the `X-GenoLens-Client` header the API requires as a CSRF guard.
 */

// Sanitize baseURL to prevent double slashes or path duplication issues
export function apiBaseUrl(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || '';
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  // Safe-guard: if somehow the url ends with double /api/v2, fix it (though unlikely)
  // But more importantly, ensure we don't end up with empty string
  return url || 'http://localhost:8000/api/v2';
}

/**
 * Outcome of an auth call. A refusal is a value, not an exception: `detail` is
 * the API's error code (`invalid_code`, `too_many_attempts`...), `body` the
 * whole payload (`attempts_left`...), and `status` is 0 when the API could not
 * be reached.
 */
export type AuthResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; detail: string | null; body: unknown };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null; // 204, or a gateway page that is not JSON
  }
}

/**
 * A call that is abandoned (its `signal` aborts, as on a deadline) is reported
 * like an unreachable API: status 0.
 */
export async function authPost<T>(
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<AuthResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/auth${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [CLIENT_HEADER]: CLIENT_NAME },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options?.signal,
    });
  } catch {
    return { ok: false, status: 0, detail: null, body: null };
  }

  const parsed = await readJson(response);
  if (response.ok) return { ok: true, status: response.status, data: parsed as T };

  const detail = (parsed as { detail?: unknown } | null)?.detail;
  return {
    ok: false,
    status: response.status,
    detail: typeof detail === 'string' ? detail : null,
    body: parsed,
  };
}

export interface MfaSecret {
  otpauth_uri: string;
  secret: string;
}

/** What the sign-in step that follows a valid password asks for. */
export type MfaStep = 'mfa' | 'mfa_setup';

export function login(email: string, password: string) {
  return authPost<{ next: MfaStep }>('/login', { email, password });
}

/**
 * A sign-in or an enrolment that opens a session also drops a sign-out left
 * pending: replayed later, it would end this new session, not the one left
 * behind (whose refresh cookie the new one has just replaced).
 */
async function opensSession<T>(call: Promise<AuthResult<T>>): Promise<AuthResult<T>> {
  const result = await call;
  if (result.ok) forgetPendingLogout();
  return result;
}

export function verifyMfa(input: { code: string } | { recovery_code: string }) {
  return opensSession(authPost<{ next: 'app' }>('/mfa/verify', input));
}

export function startMfaSetup() {
  return authPost<MfaSecret>('/mfa/setup/start');
}

export function confirmMfaSetup(code: string) {
  return opensSession(authPost<{ recovery_codes: string[] }>('/mfa/setup/confirm', { code }));
}

export function signup(email: string, password: string, fullName?: string) {
  return authPost<{ status: 'accepted' }>('/signup', { email, password, full_name: fullName });
}

export function verifyEmail(token: string) {
  return authPost<null>('/verify-email', { token });
}

export function resendVerification(email: string) {
  return authPost<{ status: 'accepted' }>('/verify-email/resend', { email });
}

export function forgotPassword(email: string) {
  return authPost<{ status: 'accepted' }>('/password/forgot', { email });
}

export function resetPassword(token: string, newPassword: string) {
  return authPost<null>('/password/reset', { token, new_password: newPassword });
}

export function acceptInvite(token: string, password: string) {
  return authPost<{ next: MfaStep }>('/invite/accept', { token, password });
}

// A page mounting a dozen queries whose token has just expired gets a dozen
// 401s together. They all wait on ONE refresh: each would otherwise rotate the
// refresh token under the others. Nothing is kept once it settles, so the next
// expiry starts a fresh one.
let inflightRefresh: Promise<boolean> | null = null;

/**
 * Renews the access token. `true` once the API has set fresh cookies; a refusal,
 * an unreachable API and a call that outlasts `REFRESH_TIMEOUT_MS` are all `false`.
 */
export function refreshSession(): Promise<boolean> {
  if (!inflightRefresh) {
    inflightRefresh = authPost<unknown>('/refresh', undefined, {
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    })
      .then((result) => result.ok)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

/**
 * Whether a refusal means "no valid session": the API answers 401 for a missing
 * or expired token. The pre-launch API (Supabase mode) answers 403 "Not
 * authenticated" when the cookie is gone. Any other 403 (`csrf_header_missing`,
 * `account_inactive`) is not a sign-out and renewing would change nothing.
 */
export function isSignedOut(status: number, detail: unknown): boolean {
  return status === 401 || (status === 403 && detail === 'Not authenticated');
}

/** `isSignedOut` for a `fetch` answer. A 403 is read from a clone: the caller can still read the body. */
export async function isSignedOutResponse(response: Response): Promise<boolean> {
  if (response.status === 401) return true;
  if (response.status !== 403) return false;
  const body = (await readJson(response.clone())) as { detail?: unknown } | null;
  return isSignedOut(response.status, body?.detail);
}

/**
 * Sends a visitor whose session is over to the sign-in page, remembering where
 * they were (they come back to it afterwards). A public page has nothing to be
 * sent back from, so it stays put. The axios instance does the same for its own
 * calls; this is for the callers of `authedFetch`.
 */
export function redirectToSignIn(): void {
  if (typeof window === 'undefined' || isPublicPath(window.location.pathname)) return;
  navigate(loginPath(window.location.pathname + window.location.search));
}

/**
 * What a call made with `authedFetch` fails with when its answer is still
 * "signed out": the renewal was refused (or the replay refused again), so the
 * session is over. The message is a sentence for the visitor, not the raw
 * refusal; the caller pairs it with `redirectToSignIn()`.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED);
    this.name = 'SessionExpiredError';
  }
}

/**
 * `fetch` for calls axios cannot serve (a streamed answer, for instance): same
 * cookies and header as the axios instance, and the same recovery. A signed-out
 * answer renews the session and replays the call once. When the renewal is
 * refused the original answer is handed back: replaying would only fail again.
 */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const send = () => {
    const headers = new Headers(init?.headers);
    headers.set(CLIENT_HEADER, CLIENT_NAME);
    return fetch(url, { ...init, credentials: 'include', headers });
  };

  const response = await send();
  if (!(await isSignedOutResponse(response))) return response;
  if (!(await refreshSession())) return response;
  return send();
}

/** Whether the readable cookie `name` is set to `1`. */
function hasFlagCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((cookie) => cookie.trim() === `${name}=1`);
}

/** `gl_session=1` is the readable hint that a session cookie exists (the real ones are httpOnly). */
export function hasSessionHint(): boolean {
  return hasFlagCookie(SESSION_HINT_COOKIE);
}

/** Whether a sign-out the API could not take is waiting to be replayed (`gl_logout_pending`). */
export function isLogoutPending(): boolean {
  return hasFlagCookie(LOGOUT_PENDING_COOKIE);
}

/** A plain cookie, not sessionStorage: it outlives the tab, as the session it stands for does. */
function rememberPendingLogout(): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    `${LOGOUT_PENDING_COOKIE}=1; path=/; max-age=${LOGOUT_PENDING_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

function forgetPendingLogout(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOGOUT_PENDING_COOKIE}=; path=/; max-age=0`;
}

/** The API did not take the logout: unreachable (status 0, deadline included) or failing (5xx). */
function logoutUnconfirmed(result: AuthResult<unknown>): boolean {
  return !result.ok && (result.status === 0 || result.status >= 500);
}

function postLogout(): Promise<AuthResult<unknown>> {
  return authPost('/logout', undefined, { signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS) });
}

/**
 * Asks the web app's own server to expire `gl_at` and `gl_session`
 * (`/auth/local-signout`). Best effort: a failure leaves `/?reauth=1` to the
 * middleware, which serves the form even to a session it can still verify.
 */
async function endLocalSession(): Promise<void> {
  try {
    await fetch(LOCAL_SIGNOUT_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { [CLIENT_HEADER]: CLIENT_NAME },
      signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
    });
  } catch {
    // Nothing more to do here: the sign-out stays pending and the page says so.
  }
}

/**
 * Ends the session. A failed call must not trap the user in a session they
 * asked to leave, nor leave them believing they are out: the page is left
 * either way, and the full reload empties the React Query cache.
 *
 * 1. `POST /auth/logout` ends the session at the API and clears its cookies,
 *    the API-host refresh cookie included. It may take up to `LOGOUT_TIMEOUT_MS`.
 * 2. `/auth/local-signout` expires `gl_at` and `gl_session` from the web app's
 *    server, whatever the API answered: the pages stop seeing the session even
 *    when the API is down.
 * 3. When the API could not be reached or failed (status 0 or 5xx), the session
 *    is still valid there: `gl_logout_pending` remembers to replay the logout
 *    (the sign-in page does, on every load), and `/?reauth=1` (no `next`) shows
 *    the form with a notice that the sign-out did not go through.
 */
export async function signOut(): Promise<void> {
  const result = await postLogout();
  document.cookie = 'account_status=; path=/; max-age=0';
  await endLocalSession();

  const unconfirmed = logoutUnconfirmed(result);
  if (unconfirmed) rememberPendingLogout();
  else forgetPendingLogout();
  navigate(unconfirmed ? '/?reauth=1' : '/');
}

/**
 * Replays a sign-out left pending: the API ends the session named by the
 * access cookie, else by the refresh cookie it still holds. `true` once nothing
 * is pending any more (the API took it, or nothing was pending), `false` when
 * the API still could not take it.
 */
export async function replayPendingLogout(): Promise<boolean> {
  if (!isLogoutPending()) return true;
  if (logoutUnconfirmed(await postLogout())) return false;
  forgetPendingLogout();
  return true;
}
