import * as React from 'react';

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Filled fraction, 0..1 (values are clamped). */
  value: number;
  /** Color of the gradient (defaults to teal). */
  tone?: 'teal' | 'purple' | 'red';
  height?: number;
}

/**
 * Meter — slim horizontal progress bar used in plan / quota cards.
 */
function Meter({
  value,
  tone = 'teal',
  height = 6,
  className = '',
  style,
  ...props
}: MeterProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const gradient: Record<NonNullable<MeterProps['tone']>, string> = {
    teal: 'linear-gradient(90deg, var(--sl-teal-dark), var(--sl-teal))',
    purple: 'linear-gradient(90deg, var(--sl-purple), var(--sl-purple-dark))',
    red: 'linear-gradient(90deg, var(--sl-red), color-mix(in oklab, var(--sl-red) 70%, #000))',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`overflow-hidden rounded ${className}`}
      style={{
        height,
        background: 'var(--n-100)',
        ...style,
      }}
      {...props}
    >
      <span
        className="block h-full rounded"
        style={{
          width: `${pct}%`,
          background: gradient[tone],
          transition: 'width .25s ease',
        }}
      />
    </div>
  );
}

export { Meter };
