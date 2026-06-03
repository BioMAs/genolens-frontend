import * as React from 'react';

export interface EmptyStateHelixProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * EmptyStateHelix — empty state with an inline DNA helix glyph.
 * Mockup: `.empty` block with helix SVG, h4, p.
 */
function EmptyStateHelix({
  title,
  description,
  action,
  className = '',
  style,
  ...props
}: EmptyStateHelixProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl p-8 text-center ${className}`}
      style={{
        border: '1.5px dashed var(--border)',
        background: 'transparent',
        ...style,
      }}
      {...props}
    >
      <svg
        className="mb-1"
        width="40"
        height="52"
        viewBox="0 0 40 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden
        style={{ color: 'var(--sl-teal)' }}
      >
        <path d="M8 4 C 32 18, 8 34, 32 48" />
        <path d="M32 4 C 8 18, 32 34, 8 48" />
        <line x1="11" y1="11" x2="29" y2="11" />
        <line x1="13" y1="19" x2="27" y2="19" />
        <line x1="13" y1="27" x2="27" y2="27" />
        <line x1="13" y1="35" x2="27" y2="35" />
        <line x1="11" y1="43" x2="29" y2="43" />
      </svg>
      <h4
        className="font-display font-semibold"
        style={{ fontSize: 15, color: 'var(--text-primary)' }}
      >
        {title}
      </h4>
      {description && (
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 12.5,
            maxWidth: 280,
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyStateHelix };
