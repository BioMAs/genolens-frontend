'use client';

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Lock } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import AuthAlert from '@/components/auth/AuthAlert';
import AuthField from '@/components/auth/AuthField';
import MfaChallengeForm from '@/components/auth/MfaChallengeForm';
import {
  hasSessionHint,
  isLogoutPending,
  login,
  replayPendingLogout,
  resendVerification,
  signOut,
  signup,
} from '@/utils/auth/client';
import {
  RESEND_SENT,
  SESSION_NOT_RESTORED,
  SIGNED_OUT,
  SIGN_OUT_FAILED,
  SIGN_OUT_FAILED_REFRESH_COOKIE,
  TRY_AGAIN,
  authErrorMessage,
  passwordProblem,
} from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';
import { refreshPath, safeNext } from '@/utils/auth/paths';

type AuthMode = 'signin' | 'signup';
/** Signing in takes two steps: the password, then a code. */
type SignInStep = 'password' | 'mfa';

const SIGNUP_SENT = 'Check your inbox — we sent a link to confirm your account.';

// The session hint and the pending sign-out are cookies: unknown on the server,
// read on the client only.
const subscribeToNothing = () => () => {};
const onServer = () => false;

/**
 * A sign-out the API could not take is replayed on every load of this page,
 * until it goes through. Returns whether one is still pending and whether the
 * replay made on this load has just ended it.
 */
function usePendingSignOut(): { pending: boolean; replayed: boolean } {
  const pending = useSyncExternalStore(subscribeToNothing, isLogoutPending, onServer);
  const [replayed, setReplayed] = useState(false);

  // Once per load: StrictMode's second effect run would post the logout twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !isLogoutPending()) return;
    started.current = true;
    void replayPendingLogout().then((done) => {
      if (done) setReplayed(true);
    });
  }, []);

  return { pending, replayed };
}

/**
 * The sign-out did not go through: the session lives on at the API. Says so,
 * and whether this browser at least stopped using it (the web app's server
 * expired its cookies, so the hint is gone), and offers to sign out again.
 */
function SignOutFailedNotice({ localSessionCleared }: { localSessionCleared: boolean }) {
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    // `signOut` replaces the page whatever happens: stay busy until then.
    void signOut();
  };

  return (
    <div className="mb-4" data-testid="sign-out-failed">
      <AuthAlert tone="error">
        {SIGN_OUT_FAILED}
        {localSessionCleared && <> {SIGN_OUT_FAILED_REFRESH_COOKIE}</>}{' '}
        <button
          type="button"
          className="auth-link inline-flex items-center gap-1 underline"
          onClick={retry}
          disabled={retrying}
        >
          {TRY_AGAIN}
          {retrying && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        </button>
      </AuthAlert>
    </div>
  );
}

/**
 * Sign in and sign up. The API sets the session cookies; this screen only moves
 * the visitor along (password, code, then `next`), and every exit is a full
 * navigation: the root layout picks its shell on the server, which a client
 * route change would not redo.
 */
function AuthScreen() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));

  // `reauth=1` with a `next` is where a failed renewal lands (/auth/refresh and the
  // middleware both pass one); a sign-out the API could not take sends `reauth=1`
  // alone, and must not offer to restore the session the visitor just left. When
  // the failure was transient the session hint is still there, and so is the
  // session: reloading would show the same form, so the visitor is offered a retry.
  const sessionHint = useSyncExternalStore(subscribeToNothing, hasSessionHint, onServer);
  const reauth = params.get('reauth') === '1';
  const renewalFailed = reauth && params.has('next') && sessionHint;

  // `reauth=1` alone is where `signOut` lands when the API could not take it.
  const pendingSignOut = usePendingSignOut();
  const signOutFailed = reauth && !params.has('next') && pendingSignOut.pending;
  const signOutReplayed = reauth && !params.has('next') && pendingSignOut.replayed;

  const [mode, setMode] = useState<AuthMode>('signin');
  // `?step=mfa` is where an accepted invitation lands: the password is set, a code is due.
  const [step, setStep] = useState<SignInStep>(params.get('step') === 'mfa' ? 'mfa' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // After "incorrect email or password": the API gives an address that is not
  // verified yet the same answer, so the visitor is offered a new link.
  const [offerResend, setOfferResend] = useState(false);

  const reset = () => {
    setError(null);
    setSuccess(null);
    setOfferResend(false);
  };

  const signIn = async () => {
    setLoading(true);
    reset();

    const result = await login(email, password);
    if (!result.ok) {
      setError(authErrorMessage(result.status, result.detail));
      setOfferResend(result.detail === 'invalid_credentials');
      setLoading(false);
      return;
    }

    if (result.data.next === 'mfa_setup') {
      // First sign-in of an account without a second factor: enrol one. Stay
      // busy, the page is about to be replaced.
      navigate(`/auth/2fa/setup?next=${encodeURIComponent(next)}`);
      return;
    }
    // The password has done its job: do not keep it around while the code is typed.
    setPassword('');
    setStep('mfa');
    setLoading(false);
  };

  const signUp = async () => {
    reset();
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    const result = await signup(email, password);
    if (result.ok) setSuccess(SIGNUP_SENT);
    else setError(authErrorMessage(result.status, result.detail));
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return mode === 'signin' ? signIn() : signUp();
  };

  const resend = async () => {
    setResending(true);
    reset();

    const result = await resendVerification(email);
    if (result.ok) {
      setSuccess(RESEND_SENT);
    } else {
      setError(authErrorMessage(result.status, result.detail));
      setOfferResend(true);
    }
    setResending(false);
  };

  /** Back to the password step: the address stays, the password is typed again. */
  const restartSignIn = (message: string | null) => {
    setStep('password');
    setPassword('');
    reset();
    setError(message);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    reset();
  };

  if (step === 'mfa') {
    return (
      <AuthCard>
        <div className="mb-6">
          <h1
            className="font-display text-heading"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            Two-step verification
          </h1>
          <p className="mt-1 text-body-sm" style={{ color: 'var(--auth-text-2)' }}>
            One more step to finish signing in
          </p>
        </div>

        <MfaChallengeForm onDone={() => navigate(next)} onRestart={restartSignIn} />

        <p className="mt-5 text-center text-[13px]">
          <button
            type="button"
            className="auth-link inline-flex items-center gap-1.5"
            onClick={() => restartSignIn(null)}
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Back to sign in
          </button>
        </p>
      </AuthCard>
    );
  }

  const isSignin = mode === 'signin';

  return (
    <>
      <div className="auth-tabs" role="tablist" aria-label="Sign in or sign up">
        <button
          type="button"
          role="tab"
          className="auth-tab"
          aria-selected={isSignin}
          onClick={() => switchMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          className="auth-tab"
          aria-selected={!isSignin}
          onClick={() => switchMode('signup')}
        >
          Sign up
        </button>
      </div>

      <AuthCard className="mt-4">
        <div className="mb-6">
          <h1
            className="font-display text-heading"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            {isSignin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-body-sm" style={{ color: 'var(--auth-text-2)' }}>
            {isSignin
              ? 'Sign in to your transcriptomics workspace'
              : 'Start analyzing your RNA-seq data'}
          </p>
        </div>

        {signOutFailed && <SignOutFailedNotice localSessionCleared={!sessionHint} />}

        {signOutReplayed && (
          <div className="mb-4">
            <AuthAlert tone="ok">{SIGNED_OUT}</AuthAlert>
          </div>
        )}

        {renewalFailed && (
          <div className="mb-4" data-testid="session-not-restored">
            <AuthAlert tone="error">
              {SESSION_NOT_RESTORED}{' '}
              {/* A full navigation: the renewal page decides where to go next. */}
              <a href={refreshPath(next)} className="auth-link underline">
                {TRY_AGAIN}
              </a>
            </AuthAlert>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} data-testid="auth-form">
          <AuthField
            id="email"
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.edu"
            data-testid="auth-email"
          />

          <AuthField
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete={isSignin ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            data-testid="auth-password"
            hint={
              isSignin ? (
                <div className="mt-2 text-right">
                  <Link
                    href="/auth/forgot"
                    className="text-caption"
                    style={{ color: 'var(--auth-muted)' }}
                  >
                    Forgot password?
                  </Link>
                </div>
              ) : undefined
            }
          />

          {error && (
            <div className="auth-alert auth-alert-error animate-fade-up" role="alert" data-testid="auth-error">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
              <Check size={16} aria-hidden="true" />
              <span>{success}</span>
            </div>
          )}

          {offerResend && (
            <p className="text-center text-[13px]">
              <button
                type="button"
                className="auth-link"
                onClick={resend}
                disabled={resending || !email.trim()}
              >
                Signed up recently? Resend the confirmation email
              </button>
            </p>
          )}

          <button type="submit" className="auth-btn !mt-5" disabled={loading} data-testid="auth-submit">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                {isSignin ? 'Sign in' : 'Create account'}
                <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p
          className="mt-3 flex items-center justify-center gap-2 text-micro"
          style={{ color: 'var(--auth-muted)' }}
        >
          <Lock size={12} aria-hidden="true" />
          Your data is encrypted and never shared
        </p>
      </AuthCard>
    </>
  );
}

// `useSearchParams` needs a Suspense boundary for the page to be prerendered;
// the shell stays outside it so the brand panel is part of the static HTML.
export default function Home() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <AuthScreen />
      </Suspense>
    </AuthShell>
  );
}
