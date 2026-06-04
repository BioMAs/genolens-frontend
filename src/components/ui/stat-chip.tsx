import React from 'react';

type StatChipTone = 'teal' | 'purple' | 'neutral' | 'warning';

interface StatChipProps {
  icon?: React.ReactNode;
  value: number | string;
  label: string;
  tone?: StatChipTone;
  className?: string;
  style?: React.CSSProperties;
}

const toneBg: Record<StatChipTone, string> = {
  teal:    'rgba(20,184,166,0.1)',
  purple:  'rgba(168,85,247,0.1)',
  neutral: 'var(--surface-2, #f3f4f6)',
  warning: 'rgba(245,158,11,0.1)',
};

const toneIcon: Record<StatChipTone, string> = {
  teal:    '#14b8a6',
  purple:  '#a855f7',
  neutral: '#6b7280',
  warning: '#f59e0b',
};

export function StatChip({ icon, value, label, tone = 'neutral', className = '', style }: StatChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${className}`}
      style={{ background: toneBg[tone], ...style }}
    >
      {icon && (
        <span style={{ color: toneIcon[tone] }}>{icon}</span>
      )}
      <span className="font-semibold" style={{ color: 'var(--text-primary, #111827)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span style={{ color: 'var(--text-muted, #6b7280)' }}>{label}</span>
    </div>
  );
}
