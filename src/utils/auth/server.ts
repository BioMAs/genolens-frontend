import { cache } from 'react';
import { cookies } from 'next/headers';

import { apiBaseUrl } from './client';
import { ACCESS_COOKIE } from './constants';
import { verifyAccessToken, type SessionClaims } from './jwt';
import type { AppUser } from './types';

async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/**
 * The session as the Next server sees it: the API sets `gl_at` on the parent
 * domain, so the server reads it with the request and checks it locally. No
 * network call, which is what makes it cheap enough for every guarded page.
 *
 * `cache` makes the layout and the page of one request share a single read.
 */
export const getSessionUser = cache(async (): Promise<SessionClaims | null> => {
  const token = await accessToken();
  return token ? verifyAccessToken(token) : null;
});

/**
 * How long the root layout waits for `/users/me`. The layout runs this for every
 * page, sign-in included: an API that accepts the connection and never answers
 * would otherwise hold every render until the platform gives up.
 */
const PROFILE_TIMEOUT_MS = 5000;

/**
 * The signed-in user's profile, read from `/users/me` with the access token as
 * a Bearer: the one place the Next server sends `Authorization`.
 *
 * `null` for anyone the API does not serve: no session, or one revoked less than
 * 15 minutes ago (the signature still checks out, the API no longer agrees).
 * That is normal traffic, and silent: 401, and 403 (inactive account).
 *
 * An API that fails is `null` too, so the root layout does not turn an outage
 * into a blank 500 on every page, but it is logged: a 5xx, a 429, a rejected or
 * timed-out call or an answer that is not the profile would otherwise look
 * exactly like anonymous visitors. Only the status or the error is logged,
 * never the request (it carries the token).
 *
 * Never cached across requests (`no-store`): who is signed in cannot be shared.
 */
export const getServerUser = cache(async (): Promise<AppUser | null> => {
  const claims = await getSessionUser();
  const token = claims && (await accessToken());
  if (!token) return null;

  try {
    const response = await fetch(`${apiBaseUrl()}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
    });

    if (response.status !== 200) {
      if (response.status !== 401 && response.status !== 403) {
        console.error(`[auth] GET /users/me answered ${response.status}; treating the user as signed out`);
      }
      return null;
    }

    const { id, email, full_name, role } = await response.json();
    return { id, email, full_name: full_name ?? null, role };
  } catch (error) {
    console.error('[auth] GET /users/me failed; treating the user as signed out:', error);
    return null;
  }
});
