import * as React from 'react';
import { cn } from '@/lib/cn';

export interface KbdHintProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * KbdHint — `<kbd>` styled like the mockup `.kbd` (mono, bordered, raised).
 * Used at the right of the global gene search to show `⌘K`.
 */
function KbdHint({ children, className = '', style, ...props }: KbdHintProps) {
  return (
    <kbd
      className={cn('font-mono', className)}
      style={{
        fontSize: 10.5,
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        // Un style inline echappe aux codemods, qui ne lisent que className.
        borderRadius: 'var(--radius-sm-px)',
        padding: '1px 5px',
        background: 'var(--surface)',
        ...style,
      }}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { KbdHint };
