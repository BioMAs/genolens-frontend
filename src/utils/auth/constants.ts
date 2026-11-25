/** Cookie holding the short-lived access JWT (ES256), set by the API. */
export const ACCESS_COOKIE = 'gl_at';

/** Non-sensitive hint that a session exists (readable by the client). */
export const SESSION_HINT_COOKIE = 'gl_session';

/**
 * Left by `/auth/refresh` for 30 seconds after a successful renewal, so the
 * middleware can tell a renewal that did not help (the new token still cannot
 * be verified here) from one that is simply due, and stop renewing in a loop.
 * Not a credential: it carries no information beyond "a renewal just ran".
 */
export const RENEWED_COOKIE = 'gl_renewed';
export const RENEWED_COOKIE_MAX_AGE_SECONDS = 30;

/**
 * How long a renewal may take. A black-holed API would otherwise leave the
 * "Restoring your session…" page spinning for ever; past this the renewal counts
 * as failed, like an unreachable API.
 */
export const REFRESH_TIMEOUT_MS = 10_000;

/**
 * How long a sign-out may wait for the API. A black-holed API would otherwise
 * leave "Sign out" doing nothing at all; past this it counts as unreachable.
 */
export const LOGOUT_TIMEOUT_MS = 10_000;

/**
 * Left by a sign-out the API could not take (unreachable, 5xx): `1`, nothing
 * else, so not a credential. The sign-in page replays `POST /auth/logout` while
 * it is set. It lives as long as a session can (30 days): past that, the
 * session it stands for has expired anyway.
 */
export const LOGOUT_PENDING_COOKIE = 'gl_logout_pending';
export const LOGOUT_PENDING_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * The web app's own route that expires `gl_at` and `gl_session`, so the pages
 * stop seeing a session even when the API cannot take the sign-out.
 */
export const LOCAL_SIGNOUT_PATH = '/auth/local-signout';

/** What to check when a renewal succeeds yet the token still does not verify. */
export const RENEWAL_LOOP_HINT =
  'Check AUTH_ISSUER and AUTH_JWKS_URL for this deployment, and that the API cookie domain covers this host.';

/** What to check when the admin app keeps bouncing a session this app accepts. */
export const ADMIN_VERIFICATION_HINT =
  "Check the admin deployment's AUTH_ISSUER and AUTH_JWKS_URL.";

/** Header the API requires on cookie-authenticated requests (CSRF guard). */
export const CLIENT_HEADER = 'X-GenoLens-Client';
export const CLIENT_NAME = 'web';

/** `aud` claim every access token must carry. */
export const TOKEN_AUDIENCE = 'genolens';

/** Where a user lands after signing in when no (safe) `next` was given. */
export const DEFAULT_AFTER_LOGIN = '/dashboard';
