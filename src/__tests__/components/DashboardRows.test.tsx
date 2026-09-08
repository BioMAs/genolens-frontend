/**
 * Le dashboard, rangé par question plutôt que par composant disponible.
 *
 * Quatre rangées : que fais-je maintenant (bandeau), où en étais-je
 * (JumpBackIn), qu'est-ce qu'il me reste (quotas), qu'est-ce que j'ai produit
 * (projets, KPI, plan). Deux métriques apparaissaient deux fois sur le même
 * écran — `total_comparisons` dans le bandeau ET dans la barre de KPI,
 * `activity_last_7_days` de même — et la création de projet était proposée
 * jusqu'à trois fois.
 */
import { render, screen } from '@testing-library/react';

import Dashboard from '@/components/Dashboard';
import type { QuotaState } from '@/hooks/useQuotas';

jest.mock('@/hooks/useAutoTour', () => ({ useAutoTour: jest.fn() }));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { name: 'Lea', email: 'lea@scilicium.com' } }),
}));

const projectsData = {
  items: [
    {
      id: 'p1',
      name: 'Skin Study',
      updated_at: '2026-09-01T00:00:00Z',
      created_at: '2026-08-01T00:00:00Z',
    },
  ],
};
let projects = projectsData;

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ data: projects }),
}));

jest.mock('@/hooks/useUserDashboardStats', () => ({
  useUserDashboardStats: () => ({
    aggregated: {
      total_projects: 4,
      total_datasets: 12,
      total_comparisons: 37,
      total_deg_genes: 2921,
      total_enrichment_pathways: 84,
      activity_last_7_days: 9,
    },
    statsMap: {},
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ data: { plan: 'STARTER', is_active: true }, isLoading: false }),
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ data: { id: 'u1', role: 'USER', subscription_plan: 'STARTER' } }),
}));

const QUOTAS: QuotaState = {
  analyses: { used: 6, max: 30, remaining: 24, unlimited: false },
  projects: { used: 4, max: 15, remaining: 11, unlimited: false },
  ai: { credits: 18, unlimited: false },
  maxDatasetsPerProject: 5,
  resetsOn: new Date(2026, 9, 1),
  tone: 'ok',
  isLoading: false,
  hasProfile: true,
  isError: false,
};

let projectLimit: { blocked: boolean; reason?: string } = { blocked: false };

jest.mock('@/hooks/useQuotas', () => ({
  ...jest.requireActual('@/hooks/useQuotas'),
  useQuotas: () => QUOTAS,
  useProjectLimit: () => projectLimit,
}));

// Les enfants qui ne participent pas à la composition sont neutralisés.
jest.mock('@/components/dashboard/JumpBackInCard', () => ({
  __esModule: true,
  default: () => <div data-testid="jump-back-in" />,
}));

jest.mock('@/components/RecentProjectsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="recent-projects" />,
}));

jest.mock('@/components/DashboardSubscriptionCard', () => ({
  __esModule: true,
  default: () => <div data-testid="plan-card" />,
}));

jest.mock('@/components/CreateProjectModal', () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  projects = projectsData;
  projectLimit = { blocked: false };
});

// ── ordre des rangées ──────────────────────────────────────────────────────

it('orders the four rows by question', () => {
  const { container } = render(<Dashboard />);

  const order = Array.from(
    container.querySelectorAll(
      '[data-tour="dashboard-welcome"], [data-testid="jump-back-in"], [data-testid="quota-analyses"], [data-tour="dashboard-kpis"]'
    )
  ).map((el) =>
    el.getAttribute('data-tour') ?? el.getAttribute('data-testid')
  );

  expect(order).toEqual([
    'dashboard-welcome',
    'jump-back-in',
    'quota-analyses',
    'dashboard-kpis',
  ]);
});

it('keeps every tour anchor the registry points at', () => {
  const { container } = render(<Dashboard />);
  for (const key of [
    'dashboard-welcome',
    'dashboard-kpis',
    'dashboard-plan',
    'dashboard-new-project',
  ]) {
    expect(container.querySelector(`[data-tour="${key}"]`)).toBeInTheDocument();
  }
});

// ── plus aucune métrique en double ────────────────────────────────────────

it('states the comparison count once, in the KPI bar', () => {
  render(<Dashboard />);
  expect(screen.getAllByText('37')).toHaveLength(1);
});

it('states the 7-day activity once', () => {
  render(<Dashboard />);
  expect(screen.getAllByText('9')).toHaveLength(1);
});

it('no longer narrates last session metrics in the banner', () => {
  render(<Dashboard />);
  expect(screen.queryByText(/comparisons analyzed/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/AI interpretations used/i)).not.toBeInTheDocument();
});

// ── règle de la CTA unique ────────────────────────────────────────────────

it('offers a single resume action in the banner when a project exists', () => {
  render(<Dashboard />);
  expect(screen.getByRole('link', { name: /resume skin study/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /read the guides/i })).not.toBeInTheDocument();
});

it('points a brand-new account at the documentation instead', () => {
  projects = { items: [] };
  render(<Dashboard />);

  const guides = screen.getByRole('link', { name: /read the guides/i });
  expect(guides).toHaveAttribute('href', '/docs');
  expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
});

it('leaves project creation to the recent-projects header, never the banner', () => {
  render(<Dashboard />);
  expect(screen.getAllByRole('button', { name: /new project/i })).toHaveLength(1);
});

// ── barrière de projet ────────────────────────────────────────────────────

it('leaves the create button usable below the limit', () => {
  render(<Dashboard />);
  expect(screen.getByRole('button', { name: /new project/i })).toBeEnabled();
});

it('disables the create button at the limit and says why', () => {
  // Aucun test ne couvrait ce cas : la barrière lisait un champ absent, donc
  // elle n'avait jamais bloqué personne.
  projectLimit = { blocked: true, reason: 'Project limit reached (15/15). Upgrade your plan.' };
  render(<Dashboard />);

  const button = screen.getByRole('button', { name: /new project/i });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('title', 'Project limit reached (15/15). Upgrade your plan.');
});
