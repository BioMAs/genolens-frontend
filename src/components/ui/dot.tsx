import * as React from 'react';

export interface DotProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ready' | 'failed' | 'pending' | 'processing';
  size?: number;
}

/**
 * Dot — small status indicator used in cards, lists and headers.
 * variant `processing` pulses via the global `gl-pulse` keyframe.
 */
function Dot({ variant = 'ready', size = 8, className = '', style, ...props }: DotProps) {
  const colorByVariant: Record<NonNullable<DotProps['variant']>, string> = {
    ready: 'var(--sl-teal)',
    failed: 'var(--sl-red)',
    pending: 'var(--text-muted)',
    processing: 'var(--sl-purple)',
  };

  return (
    <span
      aria-hidden
      className={`inline-block flex-none rounded-full ${variant === 'processing' ? 'gl-dot-pulse' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: colorByVariant[variant],
        ...style,
      }}
      {...props}
    />
  );
}

export { Dot };
