import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE, SESSION_HINT_COOKIE } from '@/utils/auth/constants';
import { verifyAccessToken } from '@/utils/auth/jwt';
import { isPublicPath, loginPath, refreshPath, safeNext } from '@/utils/auth/paths';

/**
 * Pages opened from an e-mailed link: the token rides in the URL, so it must
 * not leak through `Referer` nor sit in a shared cache.
 */
const LINK_TOKEN_PAGES = new Set(['/auth/reset', '/auth/invite', '/auth/verify-email']);

/**
 * Edge guard. A session is the `gl_at` cookie, verified here against the
 * API's public keys (no network call to the API per request, only a cached key
 * fetch). The decision, in order:
 *
 * 1. an account the API flagged as not active goes to `/suspended`;
 * 2. pages opened from an e-mailed link get privacy headers and nothing else;
 * 3. the access token is verified, or there is none;
 * 4. `/` is the sign-in page: a session is sent on, a mere hint is renewed
 *    first, otherwise the form is shown;
 * 5. any other public page is served;
 * 6. a protected page is served with a session, renewed if the hint survives,
 *    and otherwise replaced by the sign-in page.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, searchParams } = request.nextUrl;
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  // 1. Guard: redirect inactive accounts to /suspended (cookie set by the API
  // interceptor). Decided first, before any token is verified.
  const accountStatus = request.cookies.get('account_status')?.value;
  if (
    accountStatus &&
    accountStatus !== 'active' &&
    pathname !== '/suspended' &&
    pathname !== '/login' &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api')
  ) {
    return redirect('/suspended');
  }

  // 2.
  if (LINK_TOKEN_PAGES.has(pathname)) {
    const response = NextResponse.next();
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  // 3.
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;
  const hasSessionHint = request.cookies.has(SESSION_HINT_COOKIE);

  // 4.
  if (pathname === '/') {
    const next = safeNext(searchParams.get('next'));
    if (claims) return redirect(next);

    // `reauth=1` is set by /auth/refresh when the renewal failed. A refusal
    // already cleared the hint, but an unreachable API leaves it, and without
    // this check `/` and `/auth/refresh` would send the visitor back and forth.
    if (hasSessionHint && searchParams.get('reauth') !== '1') return redirect(refreshPath(next));

    return NextResponse.next();
  }

  // 5.
  if (isPublicPath(pathname)) return NextResponse.next();

  // 6.
  if (claims) return NextResponse.next();

  const target = pathname + search;
  return redirect(hasSessionHint ? refreshPath(target) : loginPath(target));
}

export const config = {
  matcher: [
    /*
     * Every path except build assets (`_next/static`, `_next/image`) and files:
     * a path with a dot is a file (`favicon.ico`, `logo.png`,
     * `manifest.webmanifest`...), no page has one.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
