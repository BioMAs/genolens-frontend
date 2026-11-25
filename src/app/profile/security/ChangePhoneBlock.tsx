'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

import AuthAlert from '@/components/auth/AuthAlert';
import AuthField from '@/components/auth/AuthField';
import RecoveryCodesPanel from '@/components/auth/RecoveryCodesPanel';
import TotpEnrollment from '@/components/auth/TotpEnrollment';
import { useConfirmMfaRotation, useStartMfaRotation } from '@/hooks/useAccountSecurity';
import { useForgetOnPageHide } from '@/hooks/useForgetOnPageHide';
import type { MfaSecret } from '@/utils/auth/client';
import { apiErrorDetail, authErrorMessage } from '@/utils/auth/messages';
import CodeField from './CodeField';
import SecurityBlock from './SecurityBlock';
import { refusalMessage } from './refusal';

/**
 * The three steps of a change of phone. `start` carries what to tell the user
 * when it is a restart (the API threw the pending secret away).
 */
type Step =
  | { name: 'start'; notice: string | null }
  | { name: 'enroll'; secret: MfaSecret; error: string | null }
  | { name: 'codes'; codes: string[] };

const FRESH_START: Step = { name: 'start', notice: null };

/** Step 1: prove it is you (password and a code from the current app) to get a new secret. */
function StartForm({
  notice,
  onStarted,
}: {
  notice: string | null;
  onStarted(secret: MfaSecret): void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(notice);
  const start = useStartMfaRotation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onStarted(await start.mutateAsync({ password, code }));
    } catch (err) {
      setError(refusalMessage(err));
    } finally {
      // Password, code and the new secret sit on the mutation until its observer is reset.
      start.reset();
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthField
        id="security-phone-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        readOnly={start.isPending}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />
      <CodeField
        id="security-phone-code"
        value={code}
        readOnly={start.isPending}
        onChange={setCode}
      />

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <button type="submit" className="auth-btn !mt-6" disabled={start.isPending}>
        Continue
        {start.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </form>
  );
}

/**
 * Moves the second factor to a new phone: password and a code from the current
 * app, then the new secret to enrol, then the new recovery codes.
 *
 * A wrong code at the confirmation makes the API throw the pending secret away
 * (`invalid_code`, or `no_rotation_pending` once it is gone), so the only way
 * on is back to the first step. Any other refusal (rate limit, network) leaves
 * the new secret on screen: it is still the one the API waits on.
 */
export default function ChangePhoneBlock() {
  const [step, setStep] = useState<Step>(FRESH_START);
  const confirm = useConfirmMfaRotation();

  // The new key and codes are not left on a page the browser may keep in its
  // back/forward cache: leaving starts the change again from the first step.
  useForgetOnPageHide(() => setStep(FRESH_START), step.name !== 'start');

  const handleConfirm = async (code: string) => {
    setStep((current) => (current.name === 'enroll' ? { ...current, error: null } : current));
    try {
      const { recovery_codes } = await confirm.mutateAsync(code);
      setStep({ name: 'codes', codes: recovery_codes });
    } catch (err) {
      const detail = apiErrorDetail(err);
      if (detail === 'invalid_code' || detail === 'no_rotation_pending') {
        setStep({ name: 'start', notice: authErrorMessage(400, 'no_rotation_pending') });
        return;
      }
      const error = refusalMessage(err);
      setStep((current) => (current.name === 'enroll' ? { ...current, error } : current));
    } finally {
      // The recovery codes (or the code typed) sit on the mutation until its observer is reset.
      confirm.reset();
    }
  };

  return (
    <SecurityBlock
      title="Change phone"
      description="Moving to a new phone? Add it to an authenticator app here. The old one stops working."
    >
      <div className="max-w-md">
        {step.name === 'start' && (
          <StartForm
            notice={step.notice}
            onStarted={(secret) => setStep({ name: 'enroll', secret, error: null })}
          />
        )}

        {step.name === 'enroll' && (
          <div className="space-y-4">
            <p className="text-body-sm" style={{ color: 'var(--auth-text-2)' }}>
              Scan this code with the authenticator app on your new phone.
            </p>
            <TotpEnrollment
              secret={step.secret}
              busy={confirm.isPending}
              error={step.error}
              onSubmit={handleConfirm}
            />
            <button type="button" className="auth-link text-body-sm" onClick={() => setStep(FRESH_START)}>
              Cancel
            </button>
          </div>
        )}

        {step.name === 'codes' && (
          <RecoveryCodesPanel
            codes={step.codes}
            doneLabel="Done"
            onDone={() => setStep(FRESH_START)}
          />
        )}
      </div>
    </SecurityBlock>
  );
}
