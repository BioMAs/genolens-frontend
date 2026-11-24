'use client';

import AuthFrame from '@/components/auth/AuthFrame';
import BackToSignInLink from '@/components/auth/BackToSignInLink';
import EmailRequestForm from '@/components/auth/EmailRequestForm';
import { forgotPassword } from '@/utils/auth/client';

// The API accepts every address and says nothing about which has an account;
// so does this page, in the same words for everybody (and without the address).
const LINK_SENT =
  "If an account exists for this address, we've sent a link to choose a new password. It is valid for one hour.";

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new one."
    >
      <EmailRequestForm
        request={forgotPassword}
        submitLabel="Send reset link"
        sentMessage={LINK_SENT}
        testId="forgot-email"
      />
      <BackToSignInLink />
    </AuthFrame>
  );
}
