import { useId, type ReactNode } from 'react';

/**
 * One part of the security section: a titled region, so a screen reader can
 * jump to it and a test can scope its queries to it.
 */
export default function SecurityBlock({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  /** Sits opposite the title (a status). */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            id={headingId}
            className="text-body-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-caption" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
