import React from 'react';

interface ChipProps {
  children: React.ReactNode;
  className?: string;
}

export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 ${className}`}
    >
      {children}
    </span>
  );
}
