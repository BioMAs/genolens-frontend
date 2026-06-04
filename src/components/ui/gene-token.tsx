import * as React from 'react';

export interface GeneTokenProps extends React.HTMLAttributes<HTMLSpanElement> {
  symbol: string;
}

/**
 * GeneToken — inline mono teal token for gene symbols (`BRCA1`, `TP53`…).
 * Adds a subtle underline-on-hover affordance.
 */
function GeneToken({ symbol, className = '', style, ...props }: GeneTokenProps) {
  return (
    <span
      className={`font-mono font-semibold tracking-tight gl-gene-token ${className}`}
      style={{
        color: 'var(--sl-teal)',
        fontSize: 13,
        ...style,
      }}
      {...props}
    >
      {symbol}
    </span>
  );
}

export { GeneToken };
