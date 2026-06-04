import React from 'react';

type DotVariant = 'ready' | 'failed' | 'pending' | 'warning';

interface DotProps {
  variant?: DotVariant;
  size?: number;
  className?: string;
}

const variantColors: Record<DotVariant, string> = {
  ready: '#14b8a6',    // teal — upregulated
  failed: '#a855f7',   // purple — downregulated
  pending: '#9ca3af',  // gray — not significant
  warning: '#f59e0b',
};

export function Dot({ variant = 'pending', size = 8, className = '' }: DotProps) {
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: variantColors[variant],
      }}
    />
  );
}
