'use client';

import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { SUPPORT_EMAIL } from '@/lib/contact';

export default function LicenseExpiredBanner() {
  const { data: license, isLoading } = useLicenseStatus();

  if (isLoading || !license || license.valid) return null;

  const expiredAt = license.expires_at
    ? new Date(license.expires_at * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] bg-danger text-on-accent text-body-sm text-center py-2 px-4 shadow-md"
    >
      <span className="font-semibold">License expired</span>
      {expiredAt && <span> on {expiredAt}</span>}
      {' — '}
      Creating projects and users and launching analyses are disabled.
      Contact{' '}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="underline hover:text-danger-ink-hover transition-colors"
      >
        {SUPPORT_EMAIL}
      </a>{' '}
      to renew your license.
    </div>
  );
}
