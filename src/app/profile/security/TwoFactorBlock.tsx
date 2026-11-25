'use client';

import { AlertTriangle } from 'lucide-react';

import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/cn';
import SecurityBlock from './SecurityBlock';

/** At or below this many codes left, the account is one lost phone from a lockout. */
const LOW_RECOVERY_CODES = 2;

function warning(remaining: number): string {
  return `Only ${remaining} recovery ${remaining === 1 ? 'code' : 'codes'} left. Generate new ones.`;
}

/** Whether two-factor authentication is on, and a warning when the recovery codes run low. */
export default function TwoFactorBlock() {
  const { data: profile } = useUserProfile();
  const remaining = profile?.recovery_codes_remaining;

  return (
    <SecurityBlock
      title="Two-factor authentication"
      description="A code from your authenticator app is asked at every sign-in."
      aside={
        profile && (
          <span
            className={cn(
              'inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium',
              profile.mfa_enabled ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-secondary',
            )}
          >
            {profile.mfa_enabled ? 'On' : 'Off'}
          </span>
        )
      }
    >
      {typeof remaining === 'number' && remaining <= LOW_RECOVERY_CODES && (
        <p className="flex items-center gap-2 rounded-control bg-warning-soft px-3 py-2 text-body-sm text-warning-ink">
          <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
          <span>{warning(remaining)}</span>
        </p>
      )}
    </SecurityBlock>
  );
}
