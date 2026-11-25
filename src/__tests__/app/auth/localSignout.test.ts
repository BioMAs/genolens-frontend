/** @jest-environment node */
/**
 * `POST /auth/local-signout` expires the two session cookies the web apps read
 * (`gl_at`, `gl_session`) from the web app's own server: when the API cannot
 * take a sign-out, the pages stop seeing the session anyway. The deletion names
 * the Domain and Path the API sets them with (a browser keeps a cookie whose
 * deletion names another scope): `AUTH_COOKIE_DOMAIN` when it is set, else
 * host-only, and `/`.
 *
 * Like the API, it requires the `X-GenoLens-Client` header: a page of another
 * site cannot send it without a CORS preflight.
 */
import { NextRequest } from 'next/server';

import { POST } from '@/app/auth/local-signout/route';

const initialDomain = process.env.AUTH_COOKIE_DOMAIN;

afterEach(() => {
  if (initialDomain === undefined) delete process.env.AUTH_COOKIE_DOMAIN;
  else process.env.AUTH_COOKIE_DOMAIN = initialDomain;
});

function signOutRequest(
  headers: Record<string, string> = { 'X-GenoLens-Client': 'web' },
  url = 'https://app.example.test/auth/local-signout',
) {
  return new NextRequest(url, { method: 'POST', headers });
}

/** The Set-Cookie line for `name`, split into its lower-cased attributes. */
function deletion(response: Response, name: string) {
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
  if (!line) return null;
  const [pair, ...attributes] = line.split(';').map((part) => part.trim());
  return { pair, attributes: attributes.map((attribute) => attribute.toLowerCase()) };
}

it('refuses a request without the client header, and leaves the cookies alone', async () => {
  const response = await POST(signOutRequest({}));

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ detail: 'csrf_header_missing' });
  expect(response.headers.getSetCookie()).toEqual([]);
});

it('refuses a blank client header', async () => {
  const response = await POST(signOutRequest({ 'X-GenoLens-Client': '   ' }));

  expect(response.status).toBe(403);
});

it('expires gl_at and gl_session on Path=/, host-only when no cookie domain is set', async () => {
  delete process.env.AUTH_COOKIE_DOMAIN;

  const response = await POST(signOutRequest());

  expect(response.status).toBe(204);
  expect(response.headers.get('cache-control')).toBe('no-store');
  for (const name of ['gl_at', 'gl_session']) {
    const cookie = deletion(response, name);
    expect(cookie).not.toBeNull();
    expect(cookie!.pair).toBe(`${name}=`);
    expect(cookie!.attributes).toEqual(
      expect.arrayContaining(['path=/', 'max-age=0', 'samesite=lax']),
    );
    expect(cookie!.attributes.some((attribute) => attribute.startsWith('domain='))).toBe(false);
  }
  expect(deletion(response, 'gl_at')!.attributes).toContain('httponly');
  expect(deletion(response, 'gl_session')!.attributes).not.toContain('httponly');
});

it('names the cookie domain the API uses when AUTH_COOKIE_DOMAIN is set', async () => {
  process.env.AUTH_COOKIE_DOMAIN = '.example.test';

  const response = await POST(signOutRequest());

  for (const name of ['gl_at', 'gl_session']) {
    expect(deletion(response, name)!.attributes).toContain('domain=.example.test');
  }
});

it('treats a blank AUTH_COOKIE_DOMAIN as unset, like the API', async () => {
  process.env.AUTH_COOKIE_DOMAIN = '';

  const response = await POST(signOutRequest());

  expect(
    deletion(response, 'gl_at')!.attributes.some((attribute) => attribute.startsWith('domain=')),
  ).toBe(false);
});

it('marks the deletions Secure over HTTPS, including behind a proxy, and not over plain HTTP', async () => {
  const direct = await POST(signOutRequest());
  expect(deletion(direct, 'gl_at')!.attributes).toContain('secure');

  const proxied = await POST(
    signOutRequest(
      { 'X-GenoLens-Client': 'web', 'X-Forwarded-Proto': 'https' },
      'http://internal:3000/auth/local-signout',
    ),
  );
  expect(deletion(proxied, 'gl_at')!.attributes).toContain('secure');

  const local = await POST(signOutRequest(undefined, 'http://localhost:3000/auth/local-signout'));
  expect(deletion(local, 'gl_at')!.attributes).not.toContain('secure');
});

it('touches no other cookie', async () => {
  const response = await POST(signOutRequest());

  const names = response.headers.getSetCookie().map((cookie) => cookie.split('=')[0]);
  expect(names.sort()).toEqual(['gl_at', 'gl_session']);
});
