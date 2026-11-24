'use client';

import { useState } from 'react';
import { Monitor } from 'lucide-react';

import AuthAlert from '@/components/auth/AuthAlert';
import {
  useAuthSessions,
  useRevokeOtherSessions,
  useRevokeSession,
} from '@/hooks/useAccountSecurity';
import type { AuthSessionInfo } from '@/types';
import { signOut } from '@/utils/auth/client';
import { apiErrorDetail } from '@/utils/auth/messages';
import SecurityBlock from './SecurityBlock';
import { describeDevice } from './device';
import { refusalMessage } from './refusal';

type Feedback = { tone: 'error' | 'ok'; text: string };

const ACTION_BUTTON =
  'h-9 flex-none rounded-control border border-strong bg-surface px-3 text-caption font-semibold text-danger-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50';

function lastActivity(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function SessionRow({
  session,
  revoking,
  onRevoke,
}: {
  session: AuthSessionInfo;
  revoking: boolean;
  onRevoke(): void;
}) {
  const device = describeDevice(session.user_agent);

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <p
          className="flex items-center gap-2 text-body-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          <Monitor
            className="h-4 w-4 flex-none"
            style={{ color: 'var(--text-secondary)' }}
            aria-hidden="true"
          />
          <span className="truncate" title={session.user_agent ?? undefined}>
            {device}
          </span>
          {session.current && (
            <span className="inline-flex flex-none items-center rounded-pill bg-success-soft px-2 py-0.5 text-caption font-medium text-success-ink">
              This device
            </span>
          )}
        </p>
        <p className="pl-6 text-caption" style={{ color: 'var(--text-secondary)' }}>
          {session.ip ?? 'Unknown address'} · Last active{' '}
          <time dateTime={session.last_used_at}>{lastActivity(session.last_used_at)}</time>
        </p>
      </div>

      {session.current ? (
        // This session's end is `signOut`'s: it also clears the cookies and leaves the page.
        <button type="button" className={ACTION_BUTTON} onClick={() => void signOut()}>
          Sign out
        </button>
      ) : (
        <button
          type="button"
          className={ACTION_BUTTON}
          aria-label={`Revoke session on ${device}`}
          disabled={revoking}
          onClick={onRevoke}
        >
          Revoke
        </button>
      )}
    </li>
  );
}

/** The devices signed in to the account: sign one out, or every one but this. */
export default function SessionsBlock() {
  const sessions = useAuthSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // This device first: it is the one the person is looking at.
  const rows = [...(sessions.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current));
  const hasOthers = rows.some((session) => !session.current);

  const handleRevoke = async (id: string) => {
    setFeedback(null);
    try {
      await revoke.mutateAsync(id);
    } catch (err) {
      // Already gone is what was asked for: the list has been read again, nothing to report.
      if (apiErrorDetail(err) !== 'session_not_found') {
        setFeedback({ tone: 'error', text: refusalMessage(err) });
      }
    }
  };

  const handleRevokeOthers = async () => {
    setFeedback(null);
    try {
      const { revoked } = await revokeOthers.mutateAsync();
      setFeedback({
        tone: 'ok',
        text: `${revoked} other ${revoked === 1 ? 'session' : 'sessions'} signed out.`,
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: refusalMessage(err) });
    }
  };

  return (
    <SecurityBlock
      title="Sessions"
      description="The devices signed in to your account. Sign out of any you do not recognise."
    >
      {sessions.isPending && (
        <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading sessions…
        </p>
      )}

      {sessions.isError && <AuthAlert tone="error">{refusalMessage(sessions.error)}</AuthAlert>}

      {sessions.isSuccess && (
        <ul role="list" className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {rows.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              revoking={revoke.isPending && revoke.variables === session.id}
              onRevoke={() => void handleRevoke(session.id)}
            />
          ))}
        </ul>
      )}

      {feedback && <AuthAlert tone={feedback.tone}>{feedback.text}</AuthAlert>}

      {sessions.isSuccess && (
        <button
          type="button"
          className={ACTION_BUTTON}
          disabled={!hasOthers || revokeOthers.isPending}
          onClick={() => void handleRevokeOthers()}
        >
          Sign out of all other sessions
        </button>
      )}
    </SecurityBlock>
  );
}
