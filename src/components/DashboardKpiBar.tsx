'use client';

import { Folder, GitCompare, Dna, Sparkles } from 'lucide-react';
import type { AggregatedStats } from '@/hooks/useUserDashboardStats';
import { StatChip } from '@/components/ui/stat-chip';

interface DashboardKpiBarProps {
  stats: AggregatedStats;
  isLoading: boolean;
}

export default function DashboardKpiBar({ stats, isLoading }: DashboardKpiBarProps) {
  const cards: { icon: React.ReactNode; value: number; label: string; tone: 'teal' | 'purple' }[] = [
    {
      icon: <Folder className="h-4 w-4" />,
      value: stats.total_projects,
      label: 'Total Projects',
      tone: 'teal',
    },
    {
      icon: <GitCompare className="h-4 w-4" />,
      value: stats.total_comparisons,
      label: 'Comparisons',
      tone: 'purple',
    },
    {
      icon: <Dna className="h-4 w-4" />,
      value: stats.total_deg_genes,
      label: 'DEGs Identified',
      tone: 'teal',
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      value: stats.activity_last_7_days,
      label: 'AI + Activity',
      tone: 'purple',
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card, i) => (
        <StatChip
          key={card.label}
          icon={card.icon}
          value={isLoading ? '—' : card.value.toLocaleString()}
          label={card.label}
          tone={card.tone}
          className="animate-fade-up"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}
