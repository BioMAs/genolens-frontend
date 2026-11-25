import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE, CLIENT_HEADER, SESSION_HINT_COOKIE } from '@/utils/auth/constants';

/** The cookies the web apps read, and whether the API sets them HttpOnly. */
const SESSION_COOKIES: Array<{ name: string; httpOnly: boolean }> = [
  { name: ACCESS_COOKIE, httpOnly: true },
  { name: SESSION_HINT_COOKIE, httpOnly: false },
];

/** Over HTTPS, directly or behind the proxy that terminates TLS. */
function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwarded === 'https' || request.nextUrl.protocol === 'https:';
}

/**
 * The web app's half of a sign-out: expires `gl_at` and `gl_session`, the two
 * cookies the pages and the middleware read, so they stop seeing the session
 * even when the API could not take `POST /auth/logout`. It ends nothing at the
 * API: the session stays valid there, and so does its refresh cookie, which
 * only the API host receives (the sign-in page replays the logout for that).
 *
 * A browser deletes a cookie only when the deletion names the scope it was set
 * with: Path `/`, and the Domain the API uses (`AUTH_COOKIE_DOMAIN`, which this
 * deployment must then share), or none when it is unset (host-only cookies,
 * as in local development).
 *
 * Like the API, it refuses a request without `X-GenoLens-Client`: a page of
 * another site cannot send that header without a CORS preflight, so it cannot
 * sign anyone out from afar.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!request.headers.get(CLIENT_HEADER)?.trim()) {
    return NextResponse.json({ detail: 'csrf_header_missing' }, { status: 403 });
  }

  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
  const secure = isHttps(request);

  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Cache-Control', 'no-store');
  for (const { name, httpOnly } of SESSION_COOKIES) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      domain,
      maxAge: 0,
      expires: new Date(0),
      httpOnly,
      sameSite: 'lax',
      secure,
    });
  }
  return response;
}
