'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import AuthFrame from '@/components/auth/AuthFrame';
import DeadLinkAlert from '@/components/auth/DeadLinkAlert';
import NewPasswordForm from '@/components/auth/NewPasswordForm';
import { useLinkToken } from '@/hooks/useLinkToken';
import { resetPassword } from '@/utils/auth/client';
import { authErrorMessage } from '@/utils/auth/messages';

/** Reset links work once and for a limited time: a dead one leads to a new request. */
function DeadLink() {
  return (
    <>
      <DeadLinkAlert />
      <Link href="/auth/forgot" className="auth-btn mt-5">
        Request a new link
        <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
      </Link>
    </>
  );
}

function ResetFlow({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<'asking' | 'changed' | 'dead'>('asking');

  const submit = async (password: string) => {
    const result = await resetPassword(token, password);
    if (result.ok) {
      setOutcome('changed');
      return null;
    }
    if (result.detail === 'invalid_token') {
      setOutcome('dead');
      return null;
    }
    return authErrorMessage(result.status, result.detail);
  };

  if (outcome === 'dead') return <DeadLink />;

  if (outcome === 'changed') {
    // No session is opened: the API revoked every one when the password changed.
    return (
      <>
        <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
          <Check size={16} aria-hidden="true" />
          <span>Your password has been changed. Sign in with your new password.</span>
        </div>
        <Link href="/" className="auth-btn mt-5">
          Go to sign in
          <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
        </Link>
      </>
    );
  }

  return <NewPasswordForm submitLabel="Update password" onSubmit={submit} />;
}

/** Opened from the e-mailed link: `/auth/reset?token=…`. */
export default function ResetPasswordPage() {
  const token = useLinkToken();

  return (
    <AuthFrame title="Choose a new password">
      {token === undefined ? null : token === null ? <DeadLink /> : <ResetFlow token={token} />}
    </AuthFrame>
  );
}
