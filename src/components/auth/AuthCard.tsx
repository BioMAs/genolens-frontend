/** The bordered surface every auth form sits on. */
export default function AuthCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`p-8 ${className}`}
      style={{
        background: 'var(--auth-card)',
        border: '1px solid var(--auth-card-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--auth-card-shadow)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
}
