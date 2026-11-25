import { NextResponse, type NextRequest } from 'next/server';

import {
  ACCESS_COOKIE,
  ADMIN_VERIFICATION_HINT,
  DEFAULT_AFTER_LOGIN,
  RENEWAL_LOOP_HINT,
  RENEWED_COOKIE,
  SESSION_HINT_COOKIE,
} from '@/utils/auth/constants';
import { verifyAccessToken } from '@/utils/auth/jwt';
import { isPublicPath, loginPath, reauthLoginPath, refreshPath, safeNext } from '@/utils/auth/paths';

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
 * 4. `/` is the sign-in page: a session is sent on (not back to the admin app
 *    that has just failed to verify it), a mere hint is renewed first,
 *    otherwise the form is shown;
 * 5. any other public page is served;
 * 6. a protected page is served with a session, renewed if the hint survives,
 *    and otherwise replaced by the sign-in page.
 *
 * Wherever a renewal is due, one that has just succeeded (`gl_renewed`) and
 * still left no verifiable token is not repeated: see `renewOrSignIn`.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, searchParams } = request.nextUrl;
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  // Sends the visitor to renew, unless a renewal has just succeeded: the API
  // then issued a token this middleware cannot verify, and renewing again would
  // bounce between the page and /auth/refresh for ever (each turn rotating the
  // refresh token). The visitor gets the sign-in form instead, marked `reauth=1`
  // so that `/` does not send them back either.
  const renewOrSignIn = (next: string) => {
    if (!request.cookies.has(RENEWED_COOKIE)) return redirect(refreshPath(next));

    // No cookie value in the message: the access token is a credential.
    console.error(
      '[auth] A session was just renewed but its access token cannot be verified here; ' +
        `sending the visitor to sign in. ${RENEWAL_LOOP_HINT}`,
    );
    return redirect(reauthLoginPath(next));
  };

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
    const rawNext = searchParams.get('next');
    const next = safeNext(rawNext);
    const reauth = searchParams.get('reauth') === '1';

    if (claims) {
      if (reauth) {
        // A sign-out the API could not take lands here with no `next`. The web
        // app's server normally expired the cookies by then (/auth/local-signout);
        // when it could not either, they are still in place: the visitor asked to
        // leave, so the sign-in form is shown rather than the dashboard.
        if (!rawNext) return NextResponse.next();

        // `reauth=1` came back from /auth/refresh, so whoever sent the visitor
        // there could not verify the token this app accepts. An absolute `next`
        // can only be the admin app: following it would start the round again.
        if (!next.startsWith('/')) {
          // No cookie value in the message: the access token is a credential.
          console.error(
            '[auth] The admin deployment rejected a session this app accepts; not sending ' +
              `the visitor back to it. ${ADMIN_VERIFICATION_HINT}`,
          );
          return redirect(DEFAULT_AFTER_LOGIN);
        }
      }
      return redirect(next);
    }

    // `reauth=1` is set by /auth/refresh when the renewal failed. A refusal
    // already cleared the hint, but an unreachable API leaves it, and without
    // this check `/` and `/auth/refresh` would send the visitor back and forth.
    if (hasSessionHint && searchParams.get('reauth') !== '1') return renewOrSignIn(next);

    return NextResponse.next();
  }

  // 5.
  if (isPublicPath(pathname)) return NextResponse.next();

  // 6.
  if (claims) return NextResponse.next();

  const target = pathname + search;
  return hasSessionHint ? renewOrSignIn(target) : redirect(loginPath(target));
}

export const config = {
  matcher: [
    /*
     * Every path except build assets (`_next/static`, `_next/image`) and static
     * files, recognised by their extension. A bare dot is not enough: a contrast
     * name such as `Treated.1_vs_Ctrl` is a path segment of a protected page.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpe?g|gif|webp|svg|txt|xml|webmanifest|js|css|map|woff2?)$).*)',
  ],
}
