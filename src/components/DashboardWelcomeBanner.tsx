'use client';

interface DashboardWelcomeBannerProps {
  userName?: string;
}

function getFirstName(name?: string): string | null {
  if (!name) return null;
  // If it looks like an email, use the part before @
  if (name.includes('@')) return name.split('@')[0];
  // Otherwise use the first word
  return name.split(' ')[0];
}

export default function DashboardWelcomeBanner({ userName }: DashboardWelcomeBannerProps) {
  const firstName = getFirstName(userName);

  return (
    <div
      className="rounded-xl px-6 py-5 mb-6 animate-fade-up"
      style={{
        background:
          'linear-gradient(135deg, var(--sl-teal-light) 0%, color-mix(in srgb, var(--sl-purple) 8%, var(--surface)) 100%)',
        border: '1px solid var(--border)',
      }}
    >
      <h2
        className="font-display font-bold tracking-tight"
        style={{ fontSize: '1.375rem', color: 'var(--text-primary)' }}
      >
        {firstName ? `Welcome back, ${firstName} 👋` : 'Welcome back 👋'}
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Your transcriptomics analysis hub — all your projects and data in one place.
      </p>
    </div>
  );
}
