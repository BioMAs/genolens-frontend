'use client';

import { useQuotas } from '@/hooks/useQuotas';
import { useUserProfile } from '@/hooks/useUserProfile';

/**
 * Discreet notice for a demo account: until when it runs and what is left of
 * its AI requests.
 *
 * Mounted next to `SubscriptionExpiredBanner` and deliberately silent once the
 * access period has ended: that banner takes over to explain read-only mode,
 * and two stacked notices would say the same thing twice.
 *
 * The AI count comes from `useQuotas`, the single authority on "what is left".
 * It is omitted when the account has no AI cap (`ai.max` absent), including
 * when the backend predates the field — an absent field never shows a limit.
 */
export default function DemoAccountBanner() {
  const { data: profile, isLoading } = useUserProfile();
  const { ai } = useQuotas();

  if (isLoading || profile?.is_demo !== true || profile.subscription_expired) return null;

  const endsOn = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const aiLeft = ai.max !== undefined ? (ai.credits ?? 0) : null;

  // Accent soft fill, where the expired banner is amber: nothing is restricted
  // yet, so this one informs rather than warns.
  return (
    <div
      role="status"
      data-testid="demo-account-banner"
      className="bg-accent-soft text-accent-ink border-b border-accent-ring text-caption text-center py-1.5 px-4"
    >
      <span className="font-semibold">Demo account</span>
      {endsOn && <span> — access until {endsOn}</span>}
      {aiLeft !== null && (
        <span>
          {' · '}
          {aiLeft} AI {aiLeft === 1 ? 'request' : 'requests'} left
        </span>
      )}
    </div>
  );
}
