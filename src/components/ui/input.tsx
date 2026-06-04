import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Input — single-line text input aligned to the SciLicium design system.
 * Focus ring uses brand teal. All colors adapt to dark mode via CSS variables.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={[
          'flex h-9 w-full rounded-lg border px-3.5 py-2 text-sm transition-all',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:border-brand-teal',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        ].join(' ')}
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
          ...style,
        }}
        placeholder={props.placeholder}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
