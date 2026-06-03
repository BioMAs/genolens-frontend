import * as React from 'react';

export interface StatChipProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon node (size 14 recommended). */
  icon?: React.ReactNode;
  /** Big numeric value (rendered in Syne, weight 700). */
  value: React.ReactNode;
  /** Caption shown below the number. */
  label: string;
  /** Tints icon + number. */
  tone?: 'teal' | 'purple' | 'neutral';
  /** Min width — defaults to mockup `92px`. */
  minWidth?: number;
}

/**
 * StatChip — small KPI tile used in project headers (StatRow).
 * Mockup: `.stat-chip` with `.sc-top`, `.n`, `.l`.
 */
function StatChip({
  icon,
  value,
  label,
  tone = 'neutral',
  minWidth = 92,
  className = '',
  style,
  ...props
}: StatChipProps) {
  const accent: Record<NonNullable<StatChipProps['tone']>, string> = {
    teal: 'var(--sl-teal)',
    purple: 'var(--sl-purple)',
    neutral: 'var(--text-secondary)',
  };

  return (
    <div
      className={`rounded-[9px] border px-3.5 py-2.75 ${className}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        minWidth,
        ...style,
      }}
      {...props}
    >
      <div className="flex items-center gap-1.75" style={{ color: accent[tone] }}>
        {icon}
      </div>
      <div
        className="font-display font-bold leading-none"
        style={{
          fontSize: 21,
          color: tone === 'neutral' ? 'var(--text-primary)' : accent[tone],
          marginTop: 6,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        className="uppercase"
        style={{
          fontSize: 10.5,
          color: 'var(--text-muted)',
          letterSpacing: '0.07em',
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export { StatChip };
