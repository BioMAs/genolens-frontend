/** @jest-environment node */
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose';

import { verifyAccessToken } from '@/utils/auth/jwt';

const ISS = 'https://auth.example.test';
const initialIssuer = process.env.AUTH_ISSUER;
const initialJwksUrl = process.env.AUTH_JWKS_URL;

let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  process.env.AUTH_ISSUER = ISS;
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  keys = createLocalJWKSet({ keys: [jwk] });
});

afterAll(() => {
  if (initialIssuer === undefined) delete process.env.AUTH_ISSUER;
  else process.env.AUTH_ISSUER = initialIssuer;
  if (initialJwksUrl === undefined) delete process.env.AUTH_JWKS_URL;
  else process.env.AUTH_JWKS_URL = initialJwksUrl;
});

type SignOptions = {
  iss?: string;
  aud?: string;
  exp?: string | number;
  /** Registered claims to leave out of the token. */
  omit?: Array<'exp' | 'iat' | 'sub'>;
};

const sign = (claims: Record<string, unknown>, opts: SignOptions = {}) => {
  const omit = new Set(opts.omit);
  const jwt = new SignJWT({ sid: 's1', amr: ['pwd', 'otp'], ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? 'genolens');
  if (!omit.has('sub')) jwt.setSubject('u1');
  if (!omit.has('iat')) jwt.setIssuedAt();
  if (!omit.has('exp')) jwt.setExpirationTime(opts.exp ?? '15m');
  return jwt.sign(privateKey);
};

describe('verifyAccessToken', () => {
  it('returns the claims of a valid token', async () => {
    expect(await verifyAccessToken(await sign({}), keys)).toEqual({
      sub: 'u1',
      sid: 's1',
      amr: ['pwd', 'otp'],
    });
  });

  it('accepts a recovery session without a one-time code', async () => {
    expect(await verifyAccessToken(await sign({ amr: ['pwd', 'recovery'] }), keys)).toEqual({
      sub: 'u1',
      sid: 's1',
      amr: ['pwd', 'recovery'],
    });
  });

  it.each([
    ['expired', () => sign({}, { exp: Math.floor(Date.now() / 1000) - 1 })],
    ['wrong audience', () => sign({}, { aud: 'other' })],
    ['wrong issuer', () => sign({}, { iss: 'https://other.example.test' })],
    ['no second factor', () => sign({ amr: ['pwd'] })],
    ['no amr claim', () => sign({ amr: undefined })],
    ['no session id', () => sign({ sid: undefined })],
    // Without `exp` a token would never expire: jose only checks the claims it finds.
    ['no expiry', () => sign({}, { omit: ['exp'] })],
    ['no issue time', () => sign({}, { omit: ['iat'] })],
    ['no subject', () => sign({}, { omit: ['sub'] })],
  ])('refuses a token: %s', async (_, make) => {
    expect(await verifyAccessToken(await make(), keys)).toBeNull();
  });

  it('refuses garbage and HS256', async () => {
    expect(await verifyAccessToken('not.a.jwt', keys)).toBeNull();
    expect(
      await verifyAccessToken(
        await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32)),
        keys,
      ),
    ).toBeNull();
  });

  it('refuses everything when the issuer is not configured', async () => {
    const token = await sign({});
    delete process.env.AUTH_ISSUER;
    try {
      expect(await verifyAccessToken(token, keys)).toBeNull();
    } finally {
      process.env.AUTH_ISSUER = ISS;
    }
  });

  it('refuses everything when no key source is configured', async () => {
    const token = await sign({});
    delete process.env.AUTH_JWKS_URL;
    expect(await verifyAccessToken(token)).toBeNull();
  });
});
