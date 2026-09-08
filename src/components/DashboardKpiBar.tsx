'use client';

import { GitCompare, Dna, Activity } from 'lucide-react';
import type { AggregatedStats } from '@/hooks/useUserDashboardStats';
import { StatChip } from '@/components/ui/stat-chip';

interface DashboardKpiBarProps {
  stats: AggregatedStats;
  isLoading: boolean;
}

export default function DashboardKpiBar({ stats, isLoading }: DashboardKpiBarProps) {
  // Trois tuiles, pas quatre. « Total Projects » est parti : la rangee de
  // quotas le donne en utilise/max, ce qui est plus informatif et evitait de
  // servir deux chiffres pour la meme grandeur. « AI + Activity » aussi : son
  // libelle annoncait deux grandeurs pour la valeur d'une seule.
  const cards: { icon: React.ReactNode; value: number; label: string; tone: 'teal' | 'purple' }[] = [
    {
      icon: <GitCompare className="h-4 w-4" />,
      value: stats.total_comparisons,
      label: 'Comparisons run',
      tone: 'purple',
    },
    {
      icon: <Dna className="h-4 w-4" />,
      value: stats.total_deg_genes,
      label: 'DEGs identified',
      tone: 'teal',
    },
    {
      icon: <Activity className="h-4 w-4" />,
      value: stats.activity_last_7_days,
      label: 'Activity (7d)',
      tone: 'purple',
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
