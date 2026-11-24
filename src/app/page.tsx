'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Lock } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';
import MfaChallengeForm from '@/components/auth/MfaChallengeForm';
import { login, resendVerification, signup } from '@/utils/auth/client';
import { RESEND_SENT, authErrorMessage, passwordProblem } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';
import { safeNext } from '@/utils/auth/paths';

type AuthMode = 'signin' | 'signup';
/** Signing in takes two steps: the password, then a code. */
type SignInStep = 'password' | 'mfa';

const SIGNUP_SENT = 'Check your inbox — we sent a link to confirm your account.';

/**
 * Sign in and sign up. The API sets the session cookies; this screen only moves
 * the visitor along (password, code, then `next`), and every exit is a full
 * navigation: the root layout picks its shell on the server, which a client
 * route change would not redo.
 */
function AuthScreen() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));

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
