'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import AuthAlert from '@/components/auth/AuthAlert';
import AuthField from '@/components/auth/AuthField';
import type { AuthResult } from '@/utils/auth/client';
import { authErrorMessage } from '@/utils/auth/messages';

interface EmailRequestFormProps {
  /** The call that asks for an e-mailed link for this address. */
  request(email: string): Promise<AuthResult<unknown>>;
  submitLabel: string;
  /** What the visitor reads once the request was accepted: the same for every address. */
  sentMessage: string;
  testId: string;
}

/**
 * An address, a button, and one answer. For the two requests whose reply must
 * not tell whether the address is known (a reset link, a new confirmation
 * link): an accepted request always gives `sentMessage`, a refused one (network,
 * rate limit) is shown as an error and is never mistaken for a sent link.
 */
export default function EmailRequestForm({
  request,
  submitLabel,
  sentMessage,
  testId,
}: EmailRequestFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await request(email);
    if (result.ok) setSent(true);
    else setError(authErrorMessage(result.status, result.detail));
    setLoading(false);
  };

  if (sent) return <AuthAlert tone="ok">{sentMessage}</AuthAlert>;

  return (
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
        data-testid={testId}
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
