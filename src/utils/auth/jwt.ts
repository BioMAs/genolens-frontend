import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { TOKEN_AUDIENCE } from './constants';

export interface SessionClaims {
  sub: string;
  sid: string;
  amr: string[];
}

// The remote key set caches and refreshes the API's keys by itself; it is
// created once, on first use, so the env vars are read when the app runs.
let remoteKeys: JWTVerifyGetKey | null = null;

function defaultKeys(): JWTVerifyGetKey | null {
  if (remoteKeys) return remoteKeys;
  const url = process.env.AUTH_JWKS_URL;
  if (!url) return null;
  remoteKeys = createRemoteJWKSet(new URL(url));
  return remoteKeys;
}

/**
 * Claims every access token must carry. jose checks `exp` only when it is
 * present: a token without one would never expire, so its absence is a refusal.
 */
const REQUIRED_CLAIMS = ['exp', 'iat', 'sub', 'sid'];

/**
 * Verifies an access token locally (signature, ES256 only, issuer, audience,
 * expiry, required claims) and returns its session claims, or `null` for
 * anything wrong: bad, expired or incomplete token, missing configuration, or
 * a session without a second factor (`amr` must contain `otp` or `recovery`).
 */
export async function verifyAccessToken(
  token: string,
  keys?: JWTVerifyGetKey,
): Promise<SessionClaims | null> {
  const issuer = process.env.AUTH_ISSUER;
  if (!issuer) return null;

  try {
    const getKey = keys ?? defaultKeys();
    if (!getKey) return null;

    const { payload } = await jwtVerify(token, getKey, {
      algorithms: ['ES256'],
      issuer,
      audience: TOKEN_AUDIENCE,
      requiredClaims: REQUIRED_CLAIMS,
    });

    const { sub, sid, amr } = payload;
    if (typeof sub !== 'string' || typeof sid !== 'string') return null;
    if (!Array.isArray(amr) || !amr.every((method) => typeof method === 'string')) return null;
    if (!amr.includes('otp') && !amr.includes('recovery')) return null;

    return { sub, sid, amr };
  } catch {
    return null;
  }
}
