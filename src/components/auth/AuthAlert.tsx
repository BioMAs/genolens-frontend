import { AlertTriangle, Check } from 'lucide-react';

/**
 * A line of feedback on an auth screen. A refusal is announced at once
 * (`alert`), a success politely (`status`).
 */
export default function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'ok';
  children: React.ReactNode;
}) {
  const isError = tone === 'error';
  const Icon = isError ? AlertTriangle : Check;

  return (
    <div
      className={`auth-alert animate-fade-up ${isError ? 'auth-alert-error' : 'auth-alert-ok'}`}
      role={isError ? 'alert' : 'status'}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
