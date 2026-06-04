'use client';

import { useLicenseStatus } from '@/hooks/useLicenseStatus';

export default function LicenseExpiredBanner() {
  const { data: license, isLoading } = useLicenseStatus();

  if (isLoading || !license || license.valid) return null;

  const expiredAt = license.expires_at
    ? new Date(license.expires_at * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-sm text-center py-2 px-4 shadow-md"
    >
      <span className="font-semibold">Licence expirée</span>
      {expiredAt && <span> le {expiredAt}</span>}
      {' — '}
      La création de projets, d&apos;utilisateurs et le lancement d&apos;analyses sont désactivés.
      Contactez{' '}
      <a
        href="mailto:support@scilicium.com"
        className="underline hover:text-red-100 transition-colors"
      >
        support@scilicium.com
      </a>{' '}
      pour renouveler votre licence.
    </div>
  );
}
