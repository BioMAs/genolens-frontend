import * as React from 'react';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional leading icon node */
  icon?: React.ReactNode;
  /** Optional bold/mono value rendered after the label */
  value?: React.ReactNode;
}

/**
 * Chip — small meta token (raised background, neutral border).
 * Used inside project cards / meta rows: `{value} samples`, `{value} comparisons`.
 */
function Chip({ icon, value, className = '', children, style, ...props }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.75 text-[11px] ${className}`}
      style={{
        background: 'var(--surface-raised)',
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
        ...style,
      }}
      {...props}
    >
      {icon}
      {value !== undefined && (
        <span
          className="font-mono font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </span>
      )}
      {children}
    </span>
  );
}

export { Chip };
