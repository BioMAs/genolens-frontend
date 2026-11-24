import { CLIENT_HEADER, CLIENT_NAME, REFRESH_TIMEOUT_MS, SESSION_HINT_COOKIE } from './constants';
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

export function verifyMfa(input: { code: string } | { recovery_code: string }) {
  return authPost<{ next: 'app' }>('/mfa/verify', input);
}

export function startMfaSetup() {
  return authPost<MfaSecret>('/mfa/setup/start');
}

export function confirmMfaSetup(code: string) {
  return authPost<{ recovery_codes: string[] }>('/mfa/setup/confirm', { code });
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

/** `gl_session=1` is the readable hint that a session cookie exists (the real ones are httpOnly). */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((cookie) => cookie.trim() === `${SESSION_HINT_COOKIE}=1`);
}

/**
 * Ends the session. A failed call must not trap the user in a session they
 * asked to leave: the page is left either way, and the full reload empties the
 * React Query cache.
 *
 * Normally the API has cleared its cookies by then. When it could not be
 * reached or failed (status 0 or 5xx) it may not have, and `/` would send the
 * still-verified visitor straight on to the dashboard as if nothing happened:
 * `reauth=1` (with no `next`) makes the middleware serve the sign-in form.
 */
export async function signOut(): Promise<void> {
  const result = await authPost('/logout');
  document.cookie = 'account_status=; path=/; max-age=0';
  const unconfirmed = !result.ok && (result.status === 0 || result.status >= 500);
  navigate(unconfirmed ? '/?reauth=1' : '/');
}
