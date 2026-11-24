'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import {
  RENEWAL_LOOP_HINT,
  RENEWED_COOKIE,
  RENEWED_COOKIE_MAX_AGE_SECONDS,
} from '@/utils/auth/constants';
import { refreshSession } from '@/utils/auth/client';
import { replaceLocation } from '@/utils/auth/navigation';
import { reauthLoginPath, safeNext } from '@/utils/auth/paths';

/**
 * Where the middleware sends a visitor whose access token has expired while
 * the session hint is still there. The session is renewed without anyone
 * having to sign in again, then the visitor resumes where they were heading.
 *
 * Both exits are full navigations: the root layout picks its shell on the
 * server, which a client-side route change would not redo.
 */
function Restoring() {
  return (
    <AuthShell>
      <AuthCard className="text-center">
        <Loader2
          className="mx-auto mb-4 h-6 w-6 animate-spin"
          style={{ color: 'var(--auth-muted)' }}
          aria-hidden="true"
        />
        <p
          role="status"
          className="text-[14px]"
          style={{ color: 'var(--auth-text-2)' }}
        >
          Restoring your session…
        </p>
      </AuthCard>
    </AuthShell>
  );
}

/**
 * Tells the middleware a renewal has just succeeded. If the page we go back to
 * still finds no verifiable token, it stops sending the visitor here instead of
 * looping. Short-lived and carrying nothing secret.
 */
function markRenewed() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${RENEWED_COOKIE}=1; Path=/; Max-Age=${RENEWED_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function hasRenewedMarker() {
  return document.cookie.split('; ').some((cookie) => cookie.startsWith(`${RENEWED_COOKIE}=`));
}

function Renewal() {
  const next = useSearchParams().get('next');

  useEffect(() => {
    // `next` is re-checked here: the middleware may have passed on an absolute
    // admin URL, and anyone can type a link to this page.
    const destination = safeNext(next);

    // A renewal succeeded moments ago and the visitor is back: the token the API
    // issued cannot be verified. The middleware stops this loop for the app's own
    // pages, but the admin app sends its visitors here too and cannot see the
    // marker, so the page refuses to renew a second time itself.
    if (hasRenewedMarker()) {
      console.error(
        '[auth] /auth/refresh was reached right after a successful renewal, so the access ' +
          `token cannot be verified; not renewing again. ${RENEWAL_LOOP_HINT}`,
      );
      replaceLocation(reauthLoginPath(destination));
      return;
    }

    // Cleanup, not a ref: under StrictMode the effect runs twice, and only the
    // last run may navigate. Both share the single in-flight refresh.
    let cancelled = false;

    refreshSession().then((renewed) => {
      if (cancelled) return;
      if (renewed) markRenewed();
      // `reauth=1` tells the middleware not to send `/` back here: the API may
      // simply be unreachable, in which case the session hint is still set.
      replaceLocation(renewed ? destination : reauthLoginPath(destination));
    });

    return () => {
      cancelled = true;
    };
  }, [next]);

  return <Restoring />;
}

// `useSearchParams` needs a Suspense boundary for the page to be prerendered.
export default function RefreshPage() {
  return (
    <Suspense fallback={<Restoring />}>
      <Renewal />
    </Suspense>
  );
}
