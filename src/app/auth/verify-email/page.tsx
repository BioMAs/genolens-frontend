'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Loader2 } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import AuthFrame from '@/components/auth/AuthFrame';
import DeadLinkAlert from '@/components/auth/DeadLinkAlert';
import { useLinkToken } from '@/hooks/useLinkToken';
import { resendVerification, verifyEmail } from '@/utils/auth/client';
import { authErrorMessage } from '@/utils/auth/messages';

// The same sentence whether or not the address needs a link: the API does not say.
const RESEND_SENT = "If this address needs confirming, we've sent a new link.";

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="auth-alert auth-alert-error animate-fade-up" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await resendVerification(email);
    if (result.ok) setSent(true);
    else setError(authErrorMessage(result.status, result.detail));
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
        <Check size={16} aria-hidden="true" />
        <span>{RESEND_SENT}</span>
      </div>
    );
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
        data-testid="resend-email"
      />

      {error && <ErrorAlert message={error} />}

      <button type="submit" className="auth-btn !mt-5" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            Send a new link
            <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}

/** A link that cannot confirm anything any more: the way on is a new one. */
function DeadLink() {
  return (
    <>
      <DeadLinkAlert />
      <ResendForm />
    </>
  );
}

/**
 * Nothing is sent when the page opens: only the click confirms. A mail
 * scanner that fetches and runs the link would otherwise confirm, in place of
 * the recipient, an account somebody else created with their address.
 */
function VerifyFlow({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<'asking' | 'confirmed' | 'dead'>('asking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setLoading(true);
    setError(null);

    const result = await verifyEmail(token);
    if (result.ok) {
      setOutcome('confirmed');
    } else if (result.detail === 'invalid_token') {
      setOutcome('dead');
    } else {
      // The link may well be fine (no network, too many attempts): stay and let the visitor retry.
      setError(authErrorMessage(result.status, result.detail));
      setLoading(false);
    }
  };

  if (outcome === 'dead') return <DeadLink />;

  if (outcome === 'confirmed') {
    return (
      <>
        <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
          <Check size={16} aria-hidden="true" />
          <span>Your email address is confirmed. You can sign in.</span>
        </div>
        <Link href="/" className="auth-btn mt-5">
          Go to sign in
          <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
        </Link>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      <button type="button" className="auth-btn" onClick={confirm} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            Confirm my email address
            <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

/** Opened from the sign-up e-mail: `/auth/verify-email?token=…`. */
export default function VerifyEmailPage() {
  const token = useLinkToken();

  return (
    <AuthFrame title="Confirm your email address">
      {token === undefined ? null : token === null ? <DeadLink /> : <VerifyFlow token={token} />}
    </AuthFrame>
  );
}
