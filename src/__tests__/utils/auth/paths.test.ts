import { isPublicPath, loginPath, refreshPath, safeNext } from '@/utils/auth/paths';

const ADMIN_URL = 'https://admin.example.test';
const initialAdminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = ADMIN_URL;
});

afterAll(() => {
  if (initialAdminUrl === undefined) delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  else process.env.NEXT_PUBLIC_ADMIN_APP_URL = initialAdminUrl;
});

describe('safeNext', () => {
  it.each(['/projects/p1?tab=2', '/dashboard'])('keeps a local path %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    '//evil.test',
    'https://evil.test/x',
    '/\\evil.test',
    'javascript:alert(1)',
    '%2F%2Fevil.test',
    '',
    null,
    undefined,
    'dashboard',
  ])('drops %s', (p) => {
    expect(safeNext(p)).toBe('/dashboard');
  });

  it.each(['/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/\u0000x', '/a\u007fb'])(
    'drops a path carrying a control character (%j)',
    (p) => {
      expect(safeNext(p)).toBe('/dashboard');
    },
  );

  it('accepts the admin origin only', () => {
    expect(safeNext('https://admin.example.test/dashboard?tab=users')).toBe(
      'https://admin.example.test/dashboard?tab=users',
    );
    expect(safeNext('https://admin.example.test.evil.test/')).toBe('/dashboard');
    expect(safeNext('http://admin.example.test/dashboard')).toBe('/dashboard');
  });

  it('uses the given fallback instead of the default', () => {
    expect(safeNext('//evil.test', '/projects')).toBe('/projects');
    expect(safeNext(null, '/projects')).toBe('/projects');
  });

  // `new URL('localhost:3001')` parses as a scheme-"localhost:" URL whose origin
  // is the opaque string "null", shared by javascript:, data: and every other
  // non-special scheme. A scheme-less admin URL must not turn into "accept them all".
  it.each(['localhost:3001', 'admin.example.test:3001', 'ftp://admin.example.test', 'not a url'])(
    'accepts no absolute URL when the admin URL is not http(s) (%s)',
    (misconfigured) => {
      process.env.NEXT_PUBLIC_ADMIN_APP_URL = misconfigured;
      try {
        for (const hostile of [
          'javascript:alert(1)',
          'data:text/html,x',
          'foo:bar',
          'localhost:3001',
          'https://admin.example.test/dashboard',
        ]) {
          expect(safeNext(hostile)).toBe('/dashboard');
        }
        expect(safeNext('/projects/p1')).toBe('/projects/p1');
      } finally {
        process.env.NEXT_PUBLIC_ADMIN_APP_URL = ADMIN_URL;
      }
    },
  );

  it('refuses every absolute URL when no admin origin is configured', () => {
    delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
    try {
      expect(safeNext('https://admin.example.test/dashboard')).toBe('/dashboard');
      expect(safeNext('/dashboard')).toBe('/dashboard');
    } finally {
      process.env.NEXT_PUBLIC_ADMIN_APP_URL = ADMIN_URL;
    }
  });
});

describe('redirect paths', () => {
  it('builds the login and refresh paths', () => {
    expect(loginPath('/projects/p1?tab=2')).toBe('/?next=%2Fprojects%2Fp1%3Ftab%3D2');
    expect(loginPath()).toBe('/');
    expect(refreshPath('/dashboard')).toBe('/auth/refresh?next=%2Fdashboard');
  });
});

describe('isPublicPath', () => {
  it('knows the public pages', () => {
    for (const p of [
      '/',
      '/login',
      '/pricing',
      '/suspended',
      '/plotly-check',
      '/auth/reset',
      '/auth/2fa/setup',
      '/api/health',
      '/cosmomics-check',
    ]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it('knows the private pages', () => {
    for (const p of ['/dashboard', '/projects/p1', '/profile', '/authx', '/apix', '/login/x']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
