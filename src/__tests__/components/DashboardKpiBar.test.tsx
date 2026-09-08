/**
 * La barre de KPI répond à « qu'est-ce que j'ai produit ». Elle affichait
 * quatre tuiles dont deux redondantes avec d'autres surfaces du même écran :
 * « Total Projects », que la rangée de quotas donne en utilisé/max — plus
 * informatif — et « AI + Activity », dont le libellé mélangeait deux grandeurs
 * alors que la valeur n'en était qu'une (l'activité sur 7 jours).
 */
import { render, screen } from '@testing-library/react';

import DashboardKpiBar from '@/components/DashboardKpiBar';
import type { AggregatedStats } from '@/hooks/useUserDashboardStats';

const STATS: AggregatedStats = {
  total_projects: 4,
  total_datasets: 12,
  total_comparisons: 37,
  total_deg_genes: 2921,
  total_enrichment_pathways: 84,
  activity_last_7_days: 9,
};

it('shows the three things the user produced', () => {
  render(<DashboardKpiBar stats={STATS} isLoading={false} />);

  expect(screen.getByText('37')).toBeInTheDocument();
  expect(screen.getByText('2,921')).toBeInTheDocument();
  expect(screen.getByText('9')).toBeInTheDocument();
});

it('no longer counts projects, which the quota row states as used of max', () => {
  render(<DashboardKpiBar stats={STATS} isLoading={false} />);
  expect(screen.queryByText(/total projects/i)).not.toBeInTheDocument();
});

it('no longer labels activity as "AI + Activity", which mixed two quantities', () => {
  render(<DashboardKpiBar stats={STATS} isLoading={false} />);
  expect(screen.queryByText(/ai \+ activity/i)).not.toBeInTheDocument();
  expect(screen.getByText(/activity/i)).toBeInTheDocument();
});

it('renders placeholders while loading', () => {
  render(<DashboardKpiBar stats={STATS} isLoading />);
  expect(screen.getAllByText('—')).toHaveLength(3);
});
