import * as React from 'react';

export interface PValTokenProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Already-formatted p-value string (e.g. `3.2e-12`). */
  value: string | number;
}

/**
 * PValToken — inline mono purple token for p-values.
 */
function PValToken({ value, className = '', style, ...props }: PValTokenProps) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{
        color: 'var(--sl-purple)',
        fontWeight: 500,
        ...style,
      }}
      {...props}
    >
      {value}
    </span>
  );
}

export { PValToken };
