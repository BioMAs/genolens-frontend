'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import AuthFrame from '@/components/auth/AuthFrame';
import { forgotPassword } from '@/utils/auth/client';
import { authErrorMessage } from '@/utils/auth/messages';

// The API accepts every address and says nothing about which has an account;
// so does this page, in the same words for everybody (and without the address).
const LINK_SENT =
  "If an account exists for this address, we've sent a link to choose a new password. It is valid for one hour.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await forgotPassword(email);
    if (result.ok) setSent(true);
    else setError(authErrorMessage(result.status, result.detail));
    setLoading(false);
  };

  return (
    <AuthFrame
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new one."
    >
      {sent ? (
        <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{LINK_SENT}</span>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
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
            data-testid="forgot-email"
          />

          {error && (
            <div className="auth-alert auth-alert-error animate-fade-up" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="auth-btn !mt-5" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                Send reset link
                <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-[13px]">
        <Link href="/" className="auth-link inline-flex items-center gap-1.5">
          <ArrowLeft size={13} aria-hidden="true" />
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
