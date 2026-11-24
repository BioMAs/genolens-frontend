/** Cookie holding the short-lived access JWT (ES256), set by the API. */
export const ACCESS_COOKIE = 'gl_at';

/** Non-sensitive hint that a session exists (readable by the client). */
export const SESSION_HINT_COOKIE = 'gl_session';

/** Header the API requires on cookie-authenticated requests (CSRF guard). */
export const CLIENT_HEADER = 'X-GenoLens-Client';
export const CLIENT_NAME = 'web';

/** `aud` claim every access token must carry. */
export const TOKEN_AUDIENCE = 'genolens';

/** Where a user lands after signing in when no (safe) `next` was given. */
export const DEFAULT_AFTER_LOGIN = '/dashboard';
