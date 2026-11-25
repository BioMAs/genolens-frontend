import AuthShell from '@/components/auth/AuthShell';
import AuthCard from '@/components/auth/AuthCard';

/** The shell, the card and the heading every page of the e-mailed-link flows shares. */
export default function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h1
            className="font-display text-[22px] font-bold"
            style={{ color: 'var(--auth-text)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--auth-text-2)' }}>
              {description}
            </p>
          )}
        </div>
        {children}
      </AuthCard>
    </AuthShell>
  );
}
