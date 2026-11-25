'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import type { MfaSecret } from '@/utils/auth/client';

interface TotpEnrollmentProps {
  /** The secret the API issued and is waiting for a first code on. */
  secret: MfaSecret;
  /** The code is on its way to the API: the form is shut. */
  busy: boolean;
  /** Why the last code was refused, in words. */
  error: string | null;
  onSubmit(code: string): void;
}

/** Displayed size in CSS pixels; the image itself is drawn at twice that, for dense screens. */
const QR_SIZE = 192;

/** `JBSWY3DPEHPK3PXP` -> `JBSW Y3DP EHPK 3PXP`: easier to read off a screen and type. */
function inGroupsOfFour(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

/**
 * Adds the account to an authenticator app: a QR code, the same secret as text
 * for when the camera is not an option, and a field for the first code the app
 * shows. The QR code is drawn here, in the browser: the secret is never handed
 * to a third-party image service.
 *
 * Whoever uses it owns the call that checks the code (`busy`, `error`,
 * `onSubmit`). Meant to sit inside `.auth-scope`, like the other auth components.
 */
export default function TotpEnrollment({ secret, busy, error, onSubmit }: TotpEnrollmentProps) {
  const uri = secret.otpauth_uri;
  // Tagged with the URI it was drawn for: a new secret never shows the old code.
  // `src: null` is a drawing that failed.
  const [drawn, setDrawn] = useState<{ uri: string; src: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [wasBusy, setWasBusy] = useState(busy);

  useEffect(() => {
    let current = true;
    const draw = async () => {
      try {
        const src = await QRCode.toDataURL(uri, { width: QR_SIZE * 2 });
        if (current) setDrawn({ uri, src });
      } catch {
        if (current) setDrawn({ uri, src: null });
      }
    };
    void draw();
    return () => {
      current = false;
    };
  }, [uri]);

  // A refused code is of no use again: once the attempt is over, start from an empty field.
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (wasBusy) setCode('');
  }

  const qr = drawn?.uri === uri ? drawn : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(code);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        {qr?.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser: nothing for next/image to optimise
          <img
            src={qr.src}
            alt="QR code to add GenoLens to your authenticator app"
            width={QR_SIZE}
            height={QR_SIZE}
            className="rounded-lg"
            style={{ border: '1px solid var(--auth-card-border)' }}
          />
        ) : qr ? (
          <p className="text-center text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
            Could not draw the QR code. Enter the key below in your authenticator app instead.
          </p>
        ) : (
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: QR_SIZE,
              height: QR_SIZE,
              border: '1px solid var(--auth-card-border)',
            }}
            aria-hidden="true"
          >
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--auth-muted)' }} />
          </div>
        )}
      </div>

      <div>
        <p className="auth-label">Or enter this key</p>
        <code
          data-testid="totp-secret"
          className="block select-all break-all rounded-lg px-3.5 py-2.5 text-center font-mono text-[14px] tracking-wider"
          style={{
            background: 'var(--auth-bg)',
            border: '1px solid var(--auth-card-border)',
            color: 'var(--auth-text)',
          }}
        >
          {inGroupsOfFour(secret.secret)}
        </code>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthField
          id="totp-code"
          name="code"
          label="Authentication code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          readOnly={busy}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123 456"
          aria-describedby="totp-code-hint"
          hint={
            <p id="totp-code-hint" className="mt-2 text-caption" style={{ color: 'var(--auth-muted)' }}>
              Enter the 6-digit code your app shows now.
            </p>
          }
        />

        {error && (
          <div className="auth-alert auth-alert-error animate-fade-up" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="auth-btn !mt-5" disabled={busy}>
          Verify
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
}
