'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import { refreshSession } from '@/utils/auth/client';
import { replaceLocation } from '@/utils/auth/navigation';
import { loginPath, safeNext } from '@/utils/auth/paths';

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

function Renewal() {
  const next = useSearchParams().get('next');

  useEffect(() => {
    // Cleanup, not a ref: under StrictMode the effect runs twice, and only the
    // last run may navigate. Both share the single in-flight refresh.
    let cancelled = false;

    refreshSession().then((renewed) => {
      if (cancelled) return;
      // `next` is re-checked here: the middleware may have passed on an absolute
      // admin URL, and anyone can type a link to this page.
      const destination = safeNext(next);
      // `reauth=1` tells the middleware not to send `/` back here: the API may
      // simply be unreachable, in which case the session hint is still set.
      replaceLocation(renewed ? destination : `${loginPath(destination)}&reauth=1`);
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
