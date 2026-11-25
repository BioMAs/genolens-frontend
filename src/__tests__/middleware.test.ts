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

  // A sign-out the API could not take leaves the cookies behind and lands on
  // `/?reauth=1`, with no `next`: the visitor asked to leave, so they get the form.
  it('shows the form to a session that asked to leave (reauth=1, no next)', async () => {
    verify.mockResolvedValue(CLAIMS);

    expect(location(await middleware(req('/?reauth=1', { gl_at: 't', gl_session: '1' })))).toBeUndefined();
    // Without the marker, a session is still sent on.
    expect(location(await middleware(req('/', { gl_at: 't', gl_session: '1' })))).toBe('/dashboard');
  });

  describe('when the admin app cannot verify a token this app accepts', () => {
    // The admin sends its visitor to /auth/refresh here, which comes back to `/` with
    // `next=<admin>&reauth=1`. Sending a verified visitor to that `next` would start
    // the round again, for ever: stop at the dashboard and say why.
    const FROM_ADMIN = '/?next=https%3A%2F%2Fadmin.example.test%2Fusers&reauth=1';
    let logged: jest.SpyInstance;

    beforeEach(() => {
      verify.mockResolvedValue(CLAIMS);
      logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logged.mockRestore();
    });

    it('keeps the visitor here instead of sending them back to the admin app', async () => {
      const res = await middleware(req(FROM_ADMIN, { gl_at: 't', gl_session: '1' }));

      expect(location(res)).toBe('/dashboard');
    });

    it('names the admin deployment once, and never a token', async () => {
      await middleware(req(FROM_ADMIN, { gl_at: 'secret-token-value', gl_session: '1' }));

      expect(logged).toHaveBeenCalledTimes(1);
      const message = logged.mock.calls[0].map(String).join(' ');
      expect(message).toMatch(/admin/i);
      expect(message).toMatch(/AUTH_ISSUER/);
      expect(message).toMatch(/AUTH_JWKS_URL/);
      expect(message).not.toContain('secret-token-value');
    });

    it('still sends a first visit from the admin app back (no reauth marker)', async () => {
      const res = await middleware(
        req('/?next=https%3A%2F%2Fadmin.example.test%2Fusers', { gl_at: 't' }),
      );

      expect(res.headers.get('location')).toBe('https://admin.example.test/users');
      expect(logged).not.toHaveBeenCalled();
    });

    it('is silent for a relative next', async () => {
      await middleware(req('/?next=%2Fprojects&reauth=1', { gl_at: 't', gl_session: '1' }));

      expect(logged).not.toHaveBeenCalled();
    });
  });
});

// A renewal that succeeds but leaves a token the middleware cannot verify
// (wrong `AUTH_ISSUER` / `AUTH_JWKS_URL`, cookie not reaching this host) would
// bounce the visitor between the page and `/auth/refresh` for ever. The refresh
// page leaves `gl_renewed` behind; seeing it, the middleware gives up renewing.
describe('a renewal that did not produce a verifiable token', () => {
  const SECRET = 'not-a-real-token-value';
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('shows the sign-in form instead of renewing again', async () => {
    const res = await middleware(
      req('/dashboard', { gl_at: SECRET, gl_session: '1', gl_renewed: '1' }),
    );

    expect(location(res)).toBe('/?next=%2Fdashboard&reauth=1');
  });

  it('keeps the whole target, query string included', async () =>
    expect(
      location(await middleware(req('/projects/p1?tab=2', { gl_session: '1', gl_renewed: '1' }))),
    ).toBe('/?next=%2Fprojects%2Fp1%3Ftab%3D2&reauth=1'));

  it('names the likely cause once, and never a token', async () => {
    await middleware(req('/dashboard', { gl_at: SECRET, gl_session: '1', gl_renewed: '1' }));

    expect(logged).toHaveBeenCalledTimes(1);
    const message = logged.mock.calls[0].map(String).join(' ');
    expect(message).toMatch(/AUTH_ISSUER/);
    expect(message).toMatch(/AUTH_JWKS_URL/);
    expect(message).toMatch(/cookie domain/i);
    expect(message).not.toContain(SECRET);
  });

  it('does not bounce the sign-in page back to the renewal either', async () => {
    const renewed = { gl_session: '1', gl_renewed: '1' };

    expect(location(await middleware(req('/?next=%2Fprojects', renewed)))).toBe(
      '/?next=%2Fprojects&reauth=1',
    );
    expect(location(await middleware(req('/', renewed)))).toBe('/?next=%2Fdashboard&reauth=1');
    // Already marked: the form is shown, as for any failed renewal.
    expect(
      location(await middleware(req('/?next=%2Fprojects&reauth=1', renewed))),
    ).toBeUndefined();
  });

  it('is silent when no renewal was on the cards', async () => {
    verify.mockResolvedValue(CLAIMS);
    const renewed = { gl_renewed: '1' };

    // A verifiable session, a stranger, a public page, a link page.
    await middleware(req('/dashboard', { gl_at: 't', gl_session: '1', ...renewed }));
    await middleware(req('/dashboard', renewed));
    await middleware(req('/pricing', { gl_session: '1', ...renewed }));
    await middleware(req('/auth/reset?token=abc', { gl_session: '1', ...renewed }));

    expect(logged).not.toHaveBeenCalled();
  });

  it('is only about a renewal that just happened', async () => {
    // Same request without the marker: renewal, as before, and no log.
    expect(location(await middleware(req('/dashboard', { gl_session: '1' })))).toBe(
      '/auth/refresh?next=%2Fdashboard',
    );
    expect(logged).not.toHaveBeenCalled();
  });

  it('lets a verifiable session through', async () => {
    verify.mockResolvedValue(CLAIMS);

    const res = await middleware(
      req('/dashboard', { gl_at: 't', gl_session: '1', gl_renewed: '1' }),
    );

    expect(location(res)).toBeUndefined();
    expect(logged).not.toHaveBeenCalled();
  });
});

describe('public pages', () => {
  it.each(['/pricing', '/login', '/suspended', '/auth/forgot', '/auth/refresh', '/auth/local-signout'])(
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
    // The suspended page offers to sign out, and the sign-out ends here.
    expect(location(await middleware(req('/auth/local-signout', status)))).toBeUndefined();
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

  // R's `make.names` and `encodeURIComponent` both keep dots: a contrast name
  // such as `Treated.1_vs_Ctrl` is a page, and must be guarded like any other.
  it('guards pages whose path contains a dot', () => {
    for (const path of [
      '/projects/p1/comparisons/Treated.1_vs_Ctrl',
      '/projects/p1/analyses/a1/comparisons/Treated.1_vs_Ctrl',
      '/projects/p1/comparisons/v1.2',
    ]) {
      expect(matches(path)).toBe(true);
    }
  });

  it('skips build assets and static files, manifest included', () => {
    for (const path of [
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/logo.png',
      '/photo.jpg',
      '/icons/logo.svg',
      '/manifest.webmanifest',
      '/robots.txt',
      '/sitemap.xml',
      '/fonts/inter.woff2',
      '/static/app.css',
      '/static/app.js.map',
    ]) {
      expect(matches(path)).toBe(false);
    }
  });
});
