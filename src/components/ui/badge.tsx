import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-brand-primary/10 text-brand-primary border-transparent',
    secondary: 'bg-gray-100 text-gray-900 border-transparent',
    destructive: 'bg-red-100 text-red-800 border-transparent',
    outline: 'text-gray-950 border-gray-300',
    success: 'bg-green-100 text-green-800 border-transparent'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export { Badge };
