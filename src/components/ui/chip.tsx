import React from 'react';

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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 ${className}`}
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
