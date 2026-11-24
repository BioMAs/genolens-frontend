'use client';

import { ShieldCheck } from 'lucide-react';

import ChangePasswordBlock from './security/ChangePasswordBlock';
import ChangePhoneBlock from './security/ChangePhoneBlock';
import RecoveryCodesBlock from './security/RecoveryCodesBlock';
import SessionsBlock from './security/SessionsBlock';
import TwoFactorBlock from './security/TwoFactorBlock';

/**
 * The account security part of the profile: two-factor status, password,
 * recovery codes, change of phone and the signed-in devices, one block each
 * (see `./security`).
 *
 * `auth-scope`: the password and code fields, the enrolment and the recovery
 * codes are the ones of the sign-in screens, and their `auth-*` classes and
 * `--auth-*` variables only resolve inside this element.
 */
export default function SecuritySection() {
  return (
    <section aria-labelledby="security-title">
      <h2
        id="security-title"
        className="mb-1 flex items-center gap-2 font-display text-body font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        <ShieldCheck className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} /> Security
      </h2>
      <p className="mb-3 text-caption" style={{ color: 'var(--text-secondary)' }}>
        Your password, two-factor authentication and the devices signed in to your account.
      </p>
      <div className="auth-scope gl-card divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <TwoFactorBlock />
        <ChangePasswordBlock />
        <RecoveryCodesBlock />
        <ChangePhoneBlock />
        <SessionsBlock />
      </div>
    </section>
  );
}
