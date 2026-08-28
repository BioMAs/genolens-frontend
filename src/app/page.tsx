'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, ArrowRight, Check, Loader2, Lock } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';

type AuthMode = 'signin' | 'signup';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const reset = () => {
    setError(null);
    setSuccess(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    reset();

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Check your inbox — we sent a link to confirm your account.');
        }
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    reset();
  };

  const isSignin = mode === 'signin';

  return (
    <AuthShell>
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
            className="font-display text-[22px] font-bold"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            {isSignin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
            {isSignin
              ? 'Sign in to your transcriptomics workspace'
              : 'Start analyzing your RNA-seq data'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth} data-testid="auth-form">
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
                    className="text-[12px]"
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
          className="mt-3 flex items-center justify-center gap-1.5 text-[11px]"
          style={{ color: 'var(--auth-muted)' }}
        >
          <Lock size={12} aria-hidden="true" />
          Your data is encrypted and never shared
        </p>
      </AuthCard>
    </AuthShell>
  );
}
