'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // The callback route already honours ?next=, so recovery links land on
    // /auth/reset with a session in place.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h1
            className="font-display text-[22px] font-bold"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            Reset your password
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div className="auth-alert auth-alert-ok animate-fade-up" role="status">
            <Check size={16} aria-hidden="true" />
            <span>
              If an account exists for {email}, a reset link is on its way. The link
              expires in one hour.
            </span>
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
      </AuthCard>
    </AuthShell>
  );
}
