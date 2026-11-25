'use client';

import { useState } from 'react';
import BackToSignInLink from '@/components/auth/BackToSignInLink';
import DeadLinkAlert from '@/components/auth/DeadLinkAlert';
import LinkTokenPage from '@/components/auth/LinkTokenPage';
import NewPasswordForm from '@/components/auth/NewPasswordForm';
import { acceptInvite } from '@/utils/auth/client';
import { authErrorMessage } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';

function DeadLink() {
  return (
    <>
      <DeadLinkAlert />
      <p className="mt-4 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
        Ask whoever invited you to send a new invitation.
      </p>
      <BackToSignInLink />
    </>
  );
}

function InviteFlow({ token }: { token: string }) {
  const [dead, setDead] = useState(false);

  const submit = async (password: string) => {
    const result = await acceptInvite(token, password);
    if (!result.ok) {
      if (result.detail === 'invalid_token') {
        setDead(true);
        return null;
      }
      return authErrorMessage(result.status, result.detail);
    }

    // The password is set, a second factor is not (yet): enrol it, or ask for
    // the code. A full navigation, as after any change of session.
    navigate(result.data.next === 'mfa_setup' ? '/auth/2fa/setup' : '/?step=mfa');
    return null;
  };

  if (dead) return <DeadLink />;
  return <NewPasswordForm submitLabel="Set password" onSubmit={submit} />;
}

/** Opened from the invitation e-mail: `/auth/invite#token=…`. */
export default function InvitePage() {
  return (
    <LinkTokenPage title="Choose your password" dead={<DeadLink />}>
      {(token) => <InviteFlow token={token} />}
    </LinkTokenPage>
  );
}
