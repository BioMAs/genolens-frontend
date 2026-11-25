'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import AuthAlert from '@/components/auth/AuthAlert';
import AuthField from '@/components/auth/AuthField';
import { useChangePassword } from '@/hooks/useAccountSecurity';
import { MIN_PASSWORD_LENGTH, PASSWORDS_DIFFER, passwordProblem } from '@/utils/auth/messages';
import SecurityBlock from './SecurityBlock';
import { refusalMessage } from './refusal';

type Feedback = { tone: 'error' | 'ok'; text: string };

/**
 * Current password, new password typed twice. Length and confirmation are
 * checked here so a typo does not cost a request; the server has the last word.
 * Nothing typed is ever shown back, and the fields are emptied once it worked.
 */
export default function ChangePasswordBlock() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const change = useChangePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const problem = passwordProblem(next);
    if (problem) {
      setFeedback({ tone: 'error', text: problem });
      return;
    }
    if (next !== confirm) {
      setFeedback({ tone: 'error', text: PASSWORDS_DIFFER });
      return;
    }

    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setFeedback({
        tone: 'ok',
        text: 'Password changed. Your other sessions were signed out.',
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: refusalMessage(err) });
    } finally {
      // The mutation holds both passwords (`variables`) until its observer is reset.
      change.reset();
    }
  };

  return (
    <SecurityBlock title="Password">
      <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
        <AuthField
          id="security-current-password"
          name="current_password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
        />
        <AuthField
          id="security-new-password"
          name="new_password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="••••••••"
          aria-describedby="security-new-password-hint"
          hint={
            <p
              id="security-new-password-hint"
              className="mt-2 text-caption"
              style={{ color: 'var(--auth-muted)' }}
            >
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          }
        />
        <AuthField
          id="security-confirm-password"
          name="confirm_password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />

        {feedback && <AuthAlert tone={feedback.tone}>{feedback.text}</AuthAlert>}

        <button type="submit" className="auth-btn !mt-6" disabled={change.isPending}>
          Change password
          {change.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        </button>
      </form>
    </SecurityBlock>
  );
}
