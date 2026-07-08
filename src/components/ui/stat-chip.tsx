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
  teal:    'var(--sl-teal-light)',
  purple:  'var(--sl-violet-light)',
  neutral: 'var(--surface-secondary)',
  warning: 'rgba(245,158,11,0.12)',
};

const toneIcon: Record<StatChipTone, string> = {
  teal:    'var(--sl-teal)',
  purple:  'var(--sl-violet)',
  neutral: 'var(--text-muted)',
  warning: '#f59e0b',
};

export function StatChip({ icon, value, label, tone = 'neutral', className = '', style }: StatChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[11px] px-3 py-2 text-sm ${className}`}
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
