'use client';

import { Eye, EyeOff } from 'lucide-react';

interface ColorblindToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}

export default function ColorblindToggle({ value, onChange, className = '' }: ColorblindToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      title={value ? 'Colorblind-safe palette active (Wong 2011) — click to revert' : 'Switch to colorblind-safe palette (Wong 2011)'}
      className={`p-1.5 rounded-sm text-muted hover:text-primary hover:bg-hover transition-colors${value ? 'text-blue-600 bg-blue-50 hover:text-blue-700 hover:bg-blue-100' : ''} ${className}`}
    >
      {value ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
