'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import AuthAlert from '@/components/auth/AuthAlert';
import RecoveryCodesPanel from '@/components/auth/RecoveryCodesPanel';
import { useRegenerateRecoveryCodes } from '@/hooks/useAccountSecurity';
import CodeField from './CodeField';
import SecurityBlock from './SecurityBlock';
import { refusalMessage } from './refusal';

/**
 * New recovery codes, on proof of a code from the authenticator app. The codes
 * live in this component's state only, and are dropped once acknowledged.
 */
export default function RecoveryCodesBlock() {
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regenerate = useRegenerateRecoveryCodes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await regenerate.mutateAsync(code);
      setCode('');
      setCodes(result.recovery_codes);
    } catch (err) {
      setError(refusalMessage(err));
    }
  };

  const handleDone = () => {
    setCodes(null);
    // The mutation keeps its last answer around: the codes must not outlive the panel.
    regenerate.reset();
  };

  return (
    <SecurityBlock
      title="Recovery codes"
      description="Each code works once, if you lose access to your authenticator app. New codes replace the old ones."
    >
      <div className="max-w-md">
        {codes ? (
          <RecoveryCodesPanel codes={codes} doneLabel="Done" onDone={handleDone} />
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <CodeField
              id="security-recovery-code"
              value={code}
              readOnly={regenerate.isPending}
              onChange={setCode}
            />

            {error && <AuthAlert tone="error">{error}</AuthAlert>}

            <button type="submit" className="auth-btn !mt-6" disabled={regenerate.isPending}>
              Generate new codes
              {regenerate.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
            </button>
          </form>
        )}
      </div>
    </SecurityBlock>
  );
}
