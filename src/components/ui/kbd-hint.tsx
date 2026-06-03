import * as React from 'react';

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
      className={`font-mono ${className}`}
      style={{
        fontSize: 10.5,
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: 4,
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
