'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // The recovery link is exchanged for a session by /auth/callback before we get
  // here. Without one, updateUser would fail with an opaque error, so check first
  // and say so plainly instead.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Both passwords must match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h1
            className="font-display text-[22px] font-bold"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            Choose a new password
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
            {ready === false
              ? 'This reset link is no longer valid.'
              : `At least ${MIN_LENGTH} characters.`}
          </p>
        </div>

        {ready === false ? (
          <>
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                Reset links expire after an hour and can only be used once. Request
                a fresh one to continue.
              </span>
            </div>
            <Link href="/auth/forgot" className="auth-btn mt-5">
              Request a new link
              <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <AuthField
              id="password"
              name="password"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="reset-password"
            />
            <AuthField
              id="confirm"
              name="confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              data-testid="reset-confirm"
            />

            {error && (
              <div className="auth-alert auth-alert-error animate-fade-up" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="auth-btn !mt-5"
              disabled={loading || ready === null}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  Update password
                  <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
