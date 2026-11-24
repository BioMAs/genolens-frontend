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
 * The signed-in user's profile, read from `/users/me` with the access token as
 * a Bearer: the one place the Next server sends `Authorization`.
 *
 * `null` for anyone the API does not serve: no session, or one revoked less than
 * 15 minutes ago (the signature still checks out, the API no longer agrees).
 * An unreachable API is `null` too, so the root layout, which calls this for
 * every page including sign-in, does not turn an outage into a blank 500.
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
    });
    if (response.status !== 200) return null;

    const { id, email, full_name, role } = await response.json();
    return { id, email, full_name: full_name ?? null, role };
  } catch {
    return null;
  }
});
