'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import AuthAlert from '@/components/auth/AuthAlert';
import DeadLinkAlert from '@/components/auth/DeadLinkAlert';
import DoneNotice from '@/components/auth/DoneNotice';
import EmailRequestForm from '@/components/auth/EmailRequestForm';
import LinkTokenPage from '@/components/auth/LinkTokenPage';
import { resendVerification, verifyEmail } from '@/utils/auth/client';
import { RESEND_SENT, authErrorMessage } from '@/utils/auth/messages';

/** A link that cannot confirm anything any more: the way on is a new one. */
function DeadLink() {
  return (
    <>
      <DeadLinkAlert />
      <div className="mt-5">
        <EmailRequestForm
          request={resendVerification}
          submitLabel="Send a new link"
          sentMessage={RESEND_SENT}
          testId="resend-email"
        />
      </div>
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
    return <DoneNotice message="Your email address is confirmed. You can sign in." />;
  }

  return (
    <div className="space-y-4">
      {error && <AuthAlert tone="error">{error}</AuthAlert>}

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
  return (
    <LinkTokenPage title="Confirm your email address" dead={<DeadLink />}>
      {(token) => <VerifyFlow token={token} />}
    </LinkTokenPage>
  );
}
