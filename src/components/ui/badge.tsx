import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'teal' | 'purple' | 'secondary' | 'destructive' | 'outline' | 'success';
}

/**
 * Badge — inline label for status, category, or metadata.
 * SciLicium palette: teal for success/active, purple for info/type, red for alert.
 */
function Badge({ className = '', variant = 'default', style, ...props }: BadgeProps) {
  const base =
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors';

  const variants: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
    // purple — info, type label (uses brand purple)
    default: {
      background: 'var(--sl-purple-light)',
      color: 'var(--sl-purple)',
      borderColor: 'var(--sl-purple-muted)',
    },
    // teal — interactive, selected, in-use
    teal: {
      background: 'var(--sl-teal-light)',
      color: 'var(--sl-teal-dark)',
      borderColor: 'var(--sl-teal-muted)',
    },
    purple: {
      background: 'var(--sl-purple-light)',
      color: 'var(--sl-purple)',
      borderColor: 'var(--sl-purple-muted)',
    },
    // success = alias for teal
    success: {
      background: 'var(--sl-teal-light)',
      color: 'var(--sl-teal-dark)',
      borderColor: 'var(--sl-teal-muted)',
    },
    // red — alerts, warnings, destructive
    destructive: {
      background: 'var(--sl-red-light)',
      color: 'var(--sl-red)',
      borderColor: 'var(--sl-red-muted)',
    },
    // neutral secondary
    secondary: {
      background: 'var(--surface-secondary)',
      color: 'var(--text-secondary)',
      borderColor: 'var(--border)',
    },
    // outline only
    outline: {
      background: 'transparent',
      color: 'var(--text-primary)',
      borderColor: 'var(--border)',
    },
  };

  return (
    <span
      className={`${base} ${className}`}
      style={{ ...variants[variant], ...style }}
      {...props}
    />
  );
}

export { Badge };
