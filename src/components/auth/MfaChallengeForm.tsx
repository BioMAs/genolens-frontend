'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import { verifyMfa } from '@/utils/auth/client';
import { attemptsLeft, authErrorMessage, invalidCodeMessage } from '@/utils/auth/messages';

interface MfaChallengeFormProps {
  /** The code was accepted and the API has set the session cookies. */
  onDone(): void;
  /** The sign-in cannot go on from here (step expired, attempts used up): start again. */
  onRestart(message: string): void;
}

/**
 * The second step of a sign-in: a code from the authenticator app, or one of
 * the recovery codes. The entry is sent as typed, the API accepts spaces,
 * lower case and a missing dash.
 */
export default function MfaChallengeForm({ onDone, onRestart }: MfaChallengeFormProps) {
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleKind = () => {
    setRecovery((current) => !current);
    setValue('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await verifyMfa(recovery ? { recovery_code: value } : { code: value });

    if (result.ok) {
      // Stay busy: the page is about to be replaced, a second submit would only fail.
      onDone();
      return;
    }

    const left = attemptsLeft(result.body);
    if (result.detail === 'challenge_expired' || (result.detail === 'invalid_code' && left === 0)) {
      onRestart(authErrorMessage(401, 'challenge_expired'));
      return;
    }

    setError(
      result.detail === 'invalid_code'
        ? invalidCodeMessage(result.body)
        : authErrorMessage(result.status, result.detail),
    );
    setValue('');
    setLoading(false);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} data-testid="auth-mfa-form">
      {/* Keyed by kind: a fresh field takes the focus when the visitor switches. */}
      <AuthField
        key={recovery ? 'recovery' : 'totp'}
        id="code"
        name="code"
        label={recovery ? 'Recovery code' : 'Authentication code'}
        type="text"
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete={recovery ? 'off' : 'one-time-code'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={recovery ? 'xxxxx-xxxxx' : '123 456'}
        aria-describedby="code-hint"
        data-testid="auth-code"
        hint={
          <p id="code-hint" className="mt-2 text-caption" style={{ color: 'var(--auth-muted)' }}>
            {recovery
              ? 'Enter one of the recovery codes you saved. Each one works once.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        }
      />

      {error && (
        <div
          className="auth-alert auth-alert-error animate-fade-up"
          role="alert"
          data-testid="auth-error"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="auth-btn !mt-5"
        disabled={loading}
        data-testid="auth-mfa-submit"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            Verify
            <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-[13px]">
        <button type="button" className="auth-link" onClick={toggleKind}>
          {recovery ? 'Use an authenticator code instead' : 'Use a recovery code'}
        </button>
      </p>
    </form>
  );
}
