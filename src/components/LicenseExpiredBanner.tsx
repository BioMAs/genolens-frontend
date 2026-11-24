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
    // `sticky` SOUS la barre du haut, pas `fixed` par-dessus : a `top-0` il
    // recouvrait la marque, la navigation et le menu du compte de la barre
    // collee. Dans le flux, il reste toujours visible (z-30, sous la barre a
    // z-40 et sous la palette de commandes et les dialogues a z-[10000]).
    <div
      role="alert"
      className="sticky top-[var(--topbar-height)] z-30 bg-danger-fill text-on-accent text-body-sm text-center py-2 px-4 shadow-md"
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
