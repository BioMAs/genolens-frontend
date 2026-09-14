import React from 'react';
import { cn } from '@/lib/cn';

interface ChipProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  value?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function Chip({ children, icon, value, className = '', style }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium bg-surface-2 text-primary',
        className,
      )}
      style={style}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {value !== undefined && (
        <span className="font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      )}
      {children}
    </span>
  );
}
