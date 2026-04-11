'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Dna, ArrowRight } from 'lucide-react';

type AuthMode = 'signin' | 'signup';

const FEATURES = [
  'Differential expression analysis',
  'Pathway enrichment — GO & GSEA',
  'PCA, UMAP & clustering',
  'AI biological interpretation',
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const reset = () => { setError(null); setSuccess(null); };

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
          setSuccess('Check your email for the confirmation link.');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    reset();
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Left brand panel (lg+) ──────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[400px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{ background: 'var(--sl-purple)' }}
      >
        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient glow blobs */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full"
          style={{ background: 'var(--sl-teal)', opacity: 0.12, filter: 'blur(60px)' }}
        />
        <div
          className="pointer-events-none absolute top-24 -right-12 w-48 h-48 rounded-full"
          style={{ background: 'var(--sl-teal)', opacity: 0.08, filter: 'blur(40px)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.14)' }}
          >
            <Dna className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-display font-bold text-white text-base tracking-tight">
            GenoLens
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-4"
            style={{ color: 'var(--sl-teal)' }}
          >
            SciLicium Platform
          </p>
          <h2
            className="font-display text-[1.875rem] font-bold text-white leading-[1.2] mb-5"
          >
            Transcriptomics<br />made intelligible.
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Explore RNA-seq datasets, identify differential expression, and gain
            AI-powered biological insight — all in one workspace.
          </p>

          <ul className="space-y-2.5">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-2.5">
                <span
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--sl-teal)' }}
                />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {feat}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} SciLicium. All rights reserved.
        </p>
      </aside>

      {/* ── Right form panel ───────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">

          {/* Mobile-only logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--sl-purple)' }}
            >
              <Dna className="h-4 w-4 text-white" />
            </div>
            <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              GenoLens
            </span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1
              className="font-display text-2xl font-bold mb-1.5"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'signin'
                ? 'Sign in to your transcriptomics workspace'
                : 'Start analyzing your RNA-seq data today'}
            </p>
          </div>

          {/* Success message */}
          {success && (
            <div
              className="mb-5 p-3.5 rounded-lg text-sm animate-fade-up"
              style={{
                background: 'var(--sl-teal-light)',
                color: 'var(--sl-teal-dark)',
                border: '1px solid var(--sl-teal-muted)',
              }}
            >
              {success}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleAuth}>
            <div>
              <label
                htmlFor="email"
                className="section-title block mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="section-title block mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="p-3 rounded-lg text-sm animate-fade-up"
                style={{
                  background: 'var(--sl-red-light)',
                  color: 'var(--sl-red)',
                  border: '1px solid var(--sl-red-muted)',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 mt-1"
              style={{ background: 'var(--sl-purple)' }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Mode switcher */}
          <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-semibold transition-colors"
              style={{ color: 'var(--sl-teal-dark)' }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = 'var(--sl-teal)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = 'var(--sl-teal-dark)')
              }
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}
