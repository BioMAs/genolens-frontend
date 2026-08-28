import Link from 'next/link';
import { ArrowRight, LinkIcon } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';

/**
 * Reached from /auth/callback when exchangeCodeForSession fails — an expired or
 * already-used confirmation or recovery link. Without this page that redirect
 * lands on a 404.
 */
export default function AuthCodeErrorPage() {
  return (
    <AuthShell>
      <AuthCard className="text-center">
        <div
          className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-[14px]"
          style={{ background: 'var(--auth-danger-bg)', color: 'var(--auth-danger)' }}
        >
          <LinkIcon size={24} aria-hidden="true" />
        </div>

        <h1
          className="font-display text-[22px] font-bold"
          style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
        >
          This link has expired
        </h1>
        <p
          className="mx-auto mt-2.5 max-w-[300px] text-[14px] leading-relaxed"
          style={{ color: 'var(--auth-text-2)' }}
        >
          Confirmation and reset links work once, and only for an hour. Request a
          new one and we&apos;ll send it straight over.
        </p>

        <Link href="/auth/forgot" className="auth-btn mt-6">
          Request a new link
          <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/"
          className="auth-link mt-4 inline-block text-[13px]"
          style={{ color: 'var(--auth-muted)' }}
        >
          Back to sign in
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
