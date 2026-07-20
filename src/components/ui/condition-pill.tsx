import * as React from 'react';

export interface ConditionPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Human-readable condition/group label. */
  label: string;
  /** Accent color (hex) used for the dot and the pill tint. */
  color?: string;
  size?: 'sm' | 'default';
}

/**
 * ConditionPill — a tinted pill with a colored dot, used to represent an
 * experimental condition/group (comparisons builder, multi-comparison, detected
 * samples). The background and border are derived from `color` so any condition
 * palette works.
 */
export function ConditionPill({
  label,
  color = 'var(--dc-indigo)',
  size = 'default',
  className = '',
  style,
  ...props
}: ConditionPillProps) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-[11px] py-1.5 text-[12.5px]';
  return (
    <span
      className={`inline-flex items-center gap-[7px] rounded-lg border font-semibold ${pad} ${className}`}
      style={{
        background: `color-mix(in oklab, ${color} 10%, var(--surface))`,
        borderColor: `color-mix(in oklab, ${color} 30%, var(--surface))`,
        color: 'var(--text-primary)',
        ...style,
      }}
      {...props}
    >
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
