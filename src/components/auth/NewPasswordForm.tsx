'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import AuthAlert from '@/components/auth/AuthAlert';
import AuthField from '@/components/auth/AuthField';
import { MIN_PASSWORD_LENGTH, PASSWORDS_DIFFER, passwordProblem } from '@/utils/auth/messages';

interface NewPasswordFormProps {
  submitLabel: string;
  /**
   * Sends the password. Resolves to what to tell the visitor when it was
   * refused, or to `null` when the page moves on (it then stays busy: a second
   * submit would only fail).
   */
  onSubmit(password: string): Promise<string | null>;
}

/**
 * A new password typed twice, for the two pages that set one from an e-mailed
 * link (reset and invitation). Length and confirmation are checked here so a
 * typo does not cost a request; the server has the last word on the rest.
 */
export default function NewPasswordForm({ submitLabel, onSubmit }: NewPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError(PASSWORDS_DIFFER);
      return;
    }

    setLoading(true);
    const refusal = await onSubmit(password);
    if (refusal === null) return;

    setError(refusal);
    setLoading(false);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthField
        id="password"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        aria-describedby="password-hint"
        data-testid="new-password"
        hint={
          <p id="password-hint" className="mt-2 text-caption" style={{ color: 'var(--auth-muted)' }}>
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        }
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
        data-testid="new-password-confirm"
      />

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <button type="submit" className="auth-btn !mt-5" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
