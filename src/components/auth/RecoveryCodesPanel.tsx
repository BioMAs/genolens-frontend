'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { downloadBlob } from '@/utils/chartExport';

const FILENAME = 'genolens-recovery-codes.txt';

interface RecoveryCodesPanelProps {
  codes: string[];
  /** Label of the button that leaves the screen: it stays shut until the codes are acknowledged. */
  doneLabel: string;
  onDone(): void;
}

/**
 * The recovery codes, shown once. The way out is locked behind an explicit
 * acknowledgement: the API never gives these codes again, so a visitor who
 * clicks through without keeping them is locked out the day the phone is lost.
 *
 * Meant to sit inside `.auth-scope`, like the other auth components.
 */
export default function RecoveryCodesPanel({ codes, doneLabel, onDone }: RecoveryCodesPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  // One code per line, the same for the file and the clipboard.
  const text = `${codes.join('\n')}\n`;

  const download = () => {
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), FILENAME);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard (insecure context, permission denied): the list and the
      // download are still there, and nothing is claimed.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--auth-text-2)' }}>
        Each code works once, if you ever lose access to your authenticator app. Keep them
        somewhere safe: they will not be shown again.
      </p>

      <ul
        role="list"
        data-testid="recovery-codes"
        className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg p-4 font-mono text-[13px] tracking-wide"
        style={{
          background: 'var(--auth-bg)',
          border: '1px solid var(--auth-card-border)',
          color: 'var(--auth-text)',
        }}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <div className="flex gap-3">
        <button type="button" className="auth-btn auth-btn-ghost" onClick={download}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download .txt
        </button>
        <button type="button" className="auth-btn auth-btn-ghost" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          Copy
        </button>
      </div>
      <p
        role="status"
        className="!mt-2 text-center text-caption"
        style={{ color: 'var(--auth-ok)' }}
      >
        {copied ? 'Copied to the clipboard.' : ''}
      </p>

      <label
        className="flex cursor-pointer items-start gap-2.5 text-[13px]"
        style={{ color: 'var(--auth-text)' }}
      >
        <input
          type="checkbox"
          data-testid="recovery-ack"
          className="mt-0.5 h-4 w-4 flex-none cursor-pointer"
          style={{ accentColor: 'var(--auth-brand)' }}
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>I have saved these codes</span>
      </label>

      <button type="button" className="auth-btn" disabled={!acknowledged} onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  );
}
