'use client';

import { Folder, Database, GitCompare, Dna, FlaskConical, Activity } from 'lucide-react';
import type { AggregatedStats } from '@/hooks/useUserDashboardStats';

interface KpiCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accentColor: string;
  isLoading: boolean;
  delay?: number;
}

function KpiCard({ icon, value, label, accentColor, isLoading, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="gl-card flex flex-col gap-2.5 p-4 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>

      {isLoading ? (
        <div className="skeleton rounded-md" style={{ height: '28px', width: '55%' }} />
      ) : (
        <span
          className="font-display font-bold tabular-nums"
          style={{ fontSize: '1.5rem', color: 'var(--text-primary)', lineHeight: 1 }}
        >
          {value.toLocaleString()}
        </span>
      )}

      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

interface DashboardKpiBarProps {
  stats: AggregatedStats;
  isLoading: boolean;
}

export default function DashboardKpiBar({ stats, isLoading }: DashboardKpiBarProps) {
  const cards: { icon: React.ReactNode; value: number; label: string; color: string }[] = [
    {
      icon: <Folder className="h-4 w-4" />,
      value: stats.total_projects,
      label: 'Projects',
      color: 'var(--sl-purple)',
    },
    {
      icon: <Database className="h-4 w-4" />,
      value: stats.total_datasets,
      label: 'Datasets',
      color: 'var(--sl-teal)',
    },
    {
      icon: <GitCompare className="h-4 w-4" />,
      value: stats.total_comparisons,
      label: 'Comparisons',
      color: 'var(--sl-purple)',
    },
    {
      icon: <Dna className="h-4 w-4" />,
      value: stats.total_deg_genes,
      label: 'DEG Genes',
      color: 'var(--sl-teal)',
    },
    {
      icon: <FlaskConical className="h-4 w-4" />,
      value: stats.total_enrichment_pathways,
      label: 'Pathways',
      color: 'var(--sl-purple)',
    },
    {
      icon: <Activity className="h-4 w-4" />,
      value: stats.activity_last_7_days,
      label: 'Activity (7d)',
      color: 'var(--sl-teal)',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, i) => (
        <KpiCard
          key={card.label}
          icon={card.icon}
          value={card.value}
          label={card.label}
          accentColor={card.color}
          isLoading={isLoading}
          delay={i * 40}
        />
      ))}
    </div>
  );
}
