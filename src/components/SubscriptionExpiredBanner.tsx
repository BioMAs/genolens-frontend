'use client';

import { useUserProfile } from '@/hooks/useUserProfile';

/**
 * Persistent notice for an account whose access period has ended.
 *
 * Distinct from `LicenseExpiredBanner`, which is about the application-wide
 * SciLicium license: this one is per-account, driven by
 * `users.subscription_ends_at`, and means read-only rather than blocked.
 *
 * Suspended and cancelled accounts never reach this component — the axios
 * interceptor redirects them to `/suspended` on the first `account_inactive`
 * response. Expiry deliberately does not redirect: the user keeps consulting the
 * projects and results they paid for, and only writes are refused, so the state
 * has to be explained in place.
 *
 * `subscription_expired` is read straight from `/users/me` rather than recomputed
 * from the date: the backend derives it with the same predicate
 * (`app/api/deps/account_state.py`) that refuses the write, so the banner and the
 * refusal cannot disagree.
 */
export default function SubscriptionExpiredBanner() {
  const { data: profile, isLoading } = useUserProfile();

  if (isLoading || !profile?.subscription_expired) return null;

  const endedOn = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Soft fill + ink, the pattern used by the other warning surfaces
  // (CreateProjectModal, EnrichmentRadarPlot). A solid `bg-warning` is not usable
  // here: `--color-warning` resolves to `--warning-ink`, which is #b45309 in light
  // mode but #f59e0b in dark — white on the latter lands at about 2.1:1. The soft
  // fill is theme-aware on both sides.
  // Amber, where the license banner is red: that one blocks, this one only holds
  // the account to reads.
  return (
    <div
      role="status"
      className="bg-warning-soft text-warning border-b border-warning/30 text-body-sm text-center py-2 px-4"
    >
      <span className="font-semibold">Read-only access</span>
      {endedOn && <span> — your access period ended on {endedOn}</span>}
      {'. '}
      You can still browse your existing projects and results, but creating
      projects, uploading datasets and launching analyses are disabled. Contact{' '}
      <a
        href="mailto:support@scilicium.com"
        className="underline hover:text-warning-ink-hover transition-colors"
      >
        support@scilicium.com
      </a>{' '}
      to renew.
    </div>
  );
}
