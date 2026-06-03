import * as React from 'react';

export interface UploadDropzoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional action button rendered below the text. */
  action?: React.ReactNode;
}

/**
 * UploadDropzone — visual dropzone (dashed border + icon + copy).
 * Pure presentational shell; wire your own file input via `action` or `onClick`.
 */
function UploadDropzone({
  icon,
  title,
  description,
  action,
  className = '',
  style,
  ...props
}: UploadDropzoneProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl p-7 text-center ${className}`}
      style={{
        border: '1.5px dashed var(--border)',
        background: 'color-mix(in oklab, var(--surface-raised) 40%, transparent)',
        ...style,
      }}
      {...props}
    >
      {icon && (
        <span
          aria-hidden
          style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}
        >
          {icon}
        </span>
      )}
      {title && (
        <div
          className="font-display font-semibold"
          style={{ fontSize: 14, color: 'var(--text-primary)' }}
        >
          {title}
        </div>
      )}
      {description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { UploadDropzone };
