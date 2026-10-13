import React from 'react';
import { cn } from '@/lib/cn';

type DotVariant = 'ready' | 'failed' | 'pending' | 'warning' | 'processing' | 'default';

interface DotProps {
  variant?: DotVariant;
  size?: number;
  className?: string;
}

/**
 * Status inks from the theme, so a dot follows light and dark like the text beside it.
 *
 * They were Tailwind hexes, light-theme values on both themes — and `failed` was violet, a hue
 * the app gives no meaning to, where every other failure on the page is the danger red.
 */
const variantColors: Record<DotVariant, string> = {
  // The `-ink` tokens, not `--color-success`: that one is `--sl-teal-dark` in both themes, a dark
  // teal that all but disappeared on the dark surface.
  ready:      'var(--color-success-ink)',
  failed:     'var(--color-danger-ink)',
  pending:    'var(--text-muted)',
  warning:    'var(--color-warning)',
  processing: 'var(--color-info)',
  default:    'var(--text-muted)',
};

export function Dot({ variant = 'pending', size = 8, className = '' }: DotProps) {
  return (
    <span
      className={cn('inline-block rounded-pill flex-shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: variantColors[variant],
      }}
    />
  );
}
