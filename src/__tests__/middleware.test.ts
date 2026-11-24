/** @jest-environment node */
/**
 * The edge guard: a session is the `gl_at` cookie, verified locally. Without
 * one, `gl_session` says a renewal is worth trying (`/auth/refresh`); without
 * either, the visitor goes to the sign-in page (the root).
 *
 * The token check is simulated: what is under test is the decision, in the
 * order the middleware takes it.
 */
import { NextRequest, type NextResponse } from 'next/server';

import { middleware, config } from '@/middleware';
import { verifyAccessToken } from '@/utils/auth/jwt';

jest.mock('@/utils/auth/jwt', () => ({ verifyAccessToken: jest.fn() }));

const verify = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;

const CLAIMS = { sub: 'u1', sid: 's1', amr: ['pwd', 'otp'] };

const req = (path: string, cookies: Record<string, string> = {}) => {
  const r = new NextRequest(new URL(path, 'https://app.example.test'));
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
};

const location = (res: NextResponse) =>
  res.headers.get('location')?.replace('https://app.example.test', '');

beforeEach(() => {
  verify.mockReset();
  verify.mockResolvedValue(null);
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = 'https://admin.example.test';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
});

describe('a protected page', () => {
  it('lets a valid session through', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(location(await middleware(req('/dashboard', { gl_at: 't' })))).toBeUndefined();
    expect(verify).toHaveBeenCalledWith('t');
  });

  it('renews when the hint survives the access token', async () =>
    expect(location(await middleware(req('/dashboard', { gl_session: '1' })))).toBe(
      '/auth/refresh?next=%2Fdashboard',
    ));

  it('renews when the access token is present but no longer valid', async () => {
    verify.mockResolvedValue(null);

    expect(
      location(await middleware(req('/dashboard', { gl_at: 'expired', gl_session: '1' }))),
    ).toBe('/auth/refresh?next=%2Fdashboard');
  });

  it('sends a stranger to the login page with next', async () =>
    expect(location(await middleware(req('/projects/p1?tab=2')))).toBe(
      '/?next=%2Fprojects%2Fp1%3Ftab%3D2',
    ));

  it('keeps the query string through a renewal', async () =>
    expect(
      location(await middleware(req('/projects/p1?tab=2', { gl_session: '1' }))),
    ).toBe('/auth/refresh?next=%2Fprojects%2Fp1%3Ftab%3D2'));

  it('does not verify anything when there is no token', async () => {
    await middleware(req('/dashboard'));

    expect(verify).not.toHaveBeenCalled();
  });
});

describe('the root, which is the sign-in page', () => {
  it('sends a signed-in visitor to next, or to the dashboard', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(location(await middleware(req('/?next=%2Fprojects', { gl_at: 't' })))).toBe('/projects');
    expect(location(await middleware(req('/', { gl_at: 't' })))).toBe('/dashboard');
    expect(location(await middleware(req('/?next=https%3A%2F%2Fevil.test', { gl_at: 't' })))).toBe(
      '/dashboard',
    );
  });

  it('sends a signed-in visitor back to the admin app when that is where they came from', async () => {
    verify.mockResolvedValue(CLAIMS);

    const res = await middleware(
      req('/?next=https%3A%2F%2Fadmin.example.test%2Fusers', { gl_at: 't' }),
    );

    expect(res.headers.get('location')).toBe('https://admin.example.test/users');
  });

  it('renews first when only the hint is left, keeping a safe next', async () => {
    expect(location(await middleware(req('/?next=%2Fprojects', { gl_session: '1' })))).toBe(
      '/auth/refresh?next=%2Fprojects',
    );
    expect(
      location(await middleware(req('/?next=https%3A%2F%2Fevil.test', { gl_session: '1' }))),
    ).toBe('/auth/refresh?next=%2Fdashboard');
  });

  it('shows the form to a stranger', async () =>
    expect(location(await middleware(req('/?next=%2Fprojects')))).toBeUndefined());

  // Review Focus 3
  it('does not loop when a refresh could not reach the API', async () => {
    expect(location(await middleware(req('/', { gl_session: '1' })))).toBe(
      '/auth/refresh?next=%2Fdashboard',
    );
    expect(
      location(await middleware(req('/?next=%2Fprojects&reauth=1', { gl_session: '1' }))),
    ).toBeUndefined();
  });

  it('still honours a valid session when reauth=1 is present', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(
      location(await middleware(req('/?next=%2Fprojects&reauth=1', { gl_at: 't', gl_session: '1' }))),
    ).toBe('/projects');
  });
});

describe('public pages', () => {
  it.each(['/pricing', '/login', '/suspended', '/auth/forgot', '/auth/refresh'])(
    'lets %s through without a session',
    async (path) => {
      expect(location(await middleware(req(path)))).toBeUndefined();
      expect(location(await middleware(req(path, { gl_session: '1' })))).toBeUndefined();
    },
  );
});

describe('pages reached from an e-mailed link', () => {
  it.each(['/auth/reset', '/auth/invite', '/auth/verify-email'])(
    'hides the token of %s from referrers and caches',
    async (path) => {
      const res = await middleware(req(`${path}?token=abc`));

      expect(location(res)).toBeUndefined();
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-store');
    },
  );

  it('does so whatever the session', async () => {
    verify.mockResolvedValue(CLAIMS);

    const res = await middleware(req('/auth/reset?token=abc', { gl_at: 't', gl_session: '1' }));

    expect(location(res)).toBeUndefined();
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('adds no such headers elsewhere', async () => {
    const res = await middleware(req('/auth/forgot'));

    expect(res.headers.get('referrer-policy')).toBeNull();
    expect(res.headers.get('cache-control')).toBeNull();
  });
});

describe('the suspended guard', () => {
  it('keeps sending a non-active account to /suspended', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(
      location(await middleware(req('/dashboard', { gl_at: 't', account_status: 'suspended' }))),
    ).toBe('/suspended');
  });

  it('is decided before the session is looked at', async () => {
    await middleware(req('/dashboard', { gl_at: 't', account_status: 'suspended' }));

    expect(verify).not.toHaveBeenCalled();
  });

  it('leaves the suspended page, the login page and the auth routes alone', async () => {
    const status = { account_status: 'suspended' };

    expect(location(await middleware(req('/suspended', status)))).toBeUndefined();
    expect(location(await middleware(req('/login', status)))).toBeUndefined();
    expect(location(await middleware(req('/auth/refresh?next=%2Fdashboard', status)))).toBeUndefined();
    expect(location(await middleware(req('/api/anything', status)))).toBeUndefined();
  });

  it('lets an active account through', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(
      location(await middleware(req('/dashboard', { gl_at: 't', account_status: 'active' }))),
    ).toBeUndefined();
  });

  it('keeps the public pages', async () =>
    expect(location(await middleware(req('/pricing')))).toBeUndefined());
});

describe('config.matcher', () => {
  const [pattern] = config.matcher;
  const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);

  it('guards pages', () => {
    for (const path of ['/', '/dashboard', '/projects/p1', '/auth/refresh']) {
      expect(matches(path)).toBe(true);
    }
  });

  it('skips build assets and every file, manifest included', () => {
    for (const path of [
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/logo.png',
      '/manifest.webmanifest',
      '/robots.txt',
    ]) {
      expect(matches(path)).toBe(false);
    }
  });
});
