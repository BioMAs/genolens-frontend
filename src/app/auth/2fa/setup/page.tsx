'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import RecoveryCodesPanel from '@/components/auth/RecoveryCodesPanel';
import TotpEnrollment from '@/components/auth/TotpEnrollment';
import { confirmMfaSetup, startMfaSetup, type MfaSecret } from '@/utils/auth/client';
import { authErrorMessage, codeRefusal } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';
import { loginPath, safeNext } from '@/utils/auth/paths';

type View =
  | { kind: 'starting' }
  | { kind: 'enrol'; secret: MfaSecret }
  | { kind: 'codes'; codes: string[] }
  // The step cannot go on (expired, refused): only a new sign-in will do.
  | { kind: 'stopped'; message: string };

function Frame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h1
            className="font-display text-[22px] font-bold"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
              {description}
            </p>
          )}
        </div>
        {children}
      </AuthCard>
    </AuthShell>
  );
}

function Preparing() {
  return (
    <Frame title="Set up two-factor authentication">
      <p
        role="status"
        className="flex items-center justify-center gap-2.5 py-8 text-[14px]"
        style={{ color: 'var(--auth-text-2)' }}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Preparing your setup…
      </p>
    </Frame>
  );
}

/**
 * Where a first sign-in lands (`next: "mfa_setup"`): the visitor adds GenoLens
 * to an authenticator app, proves it works with a first code, then keeps the
 * recovery codes. The step cookie lives on the API host, so the page needs no
 * session of its own: the session opens on the confirmation, and the exit is a
 * full navigation (the root layout picks its shell on the server).
 */
function Setup() {
  const next = safeNext(useSearchParams().get('next'));

  const [view, setView] = useState<View>({ kind: 'starting' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once per mount, and not undone by a cleanup: every start replaces the secret
  // the API is waiting on, so StrictMode's second effect run would leave the
  // QR code on screen pointing at a secret that is no longer pending.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void startMfaSetup().then((result) => {
      setView(
        result.ok
          ? { kind: 'enrol', secret: result.data }
          : { kind: 'stopped', message: authErrorMessage(result.status, result.detail) },
      );
    });
  }, []);

  const confirm = async (code: string) => {
    setBusy(true);
    setError(null);

    const result = await confirmMfaSetup(code);

    if (result.ok) {
      // The session is open from here, and these codes are never shown again:
      // stay on this screen until they are acknowledged.
      setView({ kind: 'codes', codes: result.data.recovery_codes });
      setBusy(false);
      return;
    }

    const { over, message } = codeRefusal(result);
    if (over) setView({ kind: 'stopped', message });
    else setError(message);
    setBusy(false);
  };

  switch (view.kind) {
    case 'starting':
      return <Preparing />;

    case 'enrol':
      return (
        <Frame
          title="Set up two-factor authentication"
          description="GenoLens asks for a code from an authenticator app each time you sign in. Scan the QR code to add it to yours."
        >
          <TotpEnrollment secret={view.secret} busy={busy} error={error} onSubmit={confirm} />
        </Frame>
      );

    case 'codes':
      return (
        <Frame title="Save your recovery codes">
          <RecoveryCodesPanel
            codes={view.codes}
            doneLabel="Continue to GenoLens"
            onDone={() => navigate(next)}
          />
        </Frame>
      );

    case 'stopped':
      return (
        <Frame title="Set up two-factor authentication">
          <div className="auth-alert auth-alert-error animate-fade-up" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{view.message}</span>
          </div>
          <p className="mt-5 text-center text-[13px]">
            <Link href={loginPath(next)} className="auth-link inline-flex items-center gap-1.5">
              <ArrowLeft size={13} aria-hidden="true" />
              Sign in again
            </Link>
          </p>
        </Frame>
      );
  }
}

// `useSearchParams` needs a Suspense boundary for the page to be prerendered.
export default function MfaSetupPage() {
  return (
    <Suspense fallback={<Preparing />}>
      <Setup />
    </Suspense>
  );
}
