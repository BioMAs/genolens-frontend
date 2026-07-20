import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'teal' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 rounded-[11px] text-sm font-semibold ' +
      'transition-all duration-150 select-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ' +
      'disabled:pointer-events-none disabled:opacity-50';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      // Primary: indigo — the redesign's primary CTA, with a soft indigo glow
      default:
        'bg-brand-purple text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.5)] ' +
        'hover:bg-brand-purple-dark',

      // Accent: emerald — brand / key highlights
      teal:
        'bg-brand-teal text-white shadow-[0_6px_16px_-6px_rgba(15,157,107,0.45)] ' +
        'hover:bg-brand-teal-dark',

      // Destructive: SciLicium red
      destructive:
        'bg-brand-red text-white shadow-sm hover:opacity-90',

      // Outline: surface with hover teal border
      outline:
        'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] ' +
        'hover:border-brand-teal hover:bg-[var(--hover-overlay)]',

      // Secondary: subtle filled
      secondary:
        'bg-[var(--surface-secondary)] text-[var(--text-primary)] ' +
        'border border-[var(--border)] hover:bg-[var(--hover-overlay)]',

      // Ghost: no background
      ghost:
        'text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]',

      // Link: inline text link
      link: 'text-brand-teal-dark underline-offset-4 hover:underline hover:text-brand-teal',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      default: 'h-9 px-4 py-2',
      sm:      'h-8 px-3 text-xs',
      lg:      'h-11 px-6 text-base',
      icon:    'h-9 w-9 p-0',
    };

    return (
      <button
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
