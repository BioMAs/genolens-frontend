'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import DeadLinkAlert from '@/components/auth/DeadLinkAlert';
import DoneNotice from '@/components/auth/DoneNotice';
import LinkTokenPage from '@/components/auth/LinkTokenPage';
import NewPasswordForm from '@/components/auth/NewPasswordForm';
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

  // No session is opened: the API revoked every one when the password changed.
  if (outcome === 'changed') {
    return <DoneNotice message="Your password has been changed. Sign in with your new password." />;
  }

  return <NewPasswordForm submitLabel="Update password" onSubmit={submit} />;
}

/** Opened from the e-mailed link: `/auth/reset#token=…`. */
export default function ResetPasswordPage() {
  return (
    <LinkTokenPage title="Choose a new password" dead={<DeadLink />}>
      {(token) => <ResetFlow token={token} />}
    </LinkTokenPage>
  );
}
