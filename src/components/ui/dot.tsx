import React from 'react';

type DotVariant = 'ready' | 'failed' | 'pending' | 'warning' | 'processing' | 'default';

interface DotProps {
  variant?: DotVariant;
  size?: number;
  className?: string;
}

const variantColors: Record<DotVariant, string> = {
  ready:      '#14b8a6',
  failed:     '#a855f7',
  pending:    '#9ca3af',
  warning:    '#f59e0b',
  processing: '#3b82f6',
  default:    '#9ca3af',
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
