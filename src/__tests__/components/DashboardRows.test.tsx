/**
 * Le dashboard, rempli : le travail d'abord, le compte ensuite.
 *
 *   1. En-tete — salutation, reprise, helice de donnees
 *   2. Chiffres du compte — une bande reglee
 *   3. Grille — derniers resultats | actions rapides,
 *               projets recents    | activite
 *   4. Le plan et ses jauges, en bande pleine largeur
 *
 * Les blocs sont rendus pour de vrai ; seules les sources de donnees sont
 * simulees. L'helice ne se dessine pas sous jsdom (pas de ResizeObserver) :
 * sa geometrie est couverte par dashboard/dataHelix.test.ts.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import Dashboard from '@/components/Dashboard';
import type { QuotaState } from '@/hooks/useQuotas';

jest.mock('@/hooks/useAutoTour', () => ({ useAutoTour: jest.fn() }));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'me', name: 'Lea Martin', email: 'lea@scilicium.com' } }),
}));

const PROJECTS = {
  items: [
    { id: 'p1', name: 'Skin Study', updated_at: '2026-10-11T00:00:00Z', created_at: '2026-08-01T00:00:00Z' },
  ],
};
let projects: { items: typeof PROJECTS.items } = PROJECTS;
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

let profile: Record<string, unknown> = { id: 'u1', role: 'USER', subscription_plan: 'STARTER' };
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ data: profile }),
}));

const QUOTAS: QuotaState = {
  analyses: { used: 6, max: 30, remaining: 24, unlimited: false },
  projects: { used: 4, max: 15, remaining: 11, unlimited: false },
  ai: { credits: 18, max: 30, unlimited: false },
  maxDatasetsPerProject: 5,
  resetsOn: new Date(2026, 9, 1),
  isDemo: false,
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

const COMPARISONS = [
  {
    project_id: 'p1',
    project_name: 'Skin Study',
    dataset_name: 'DESeq2',
    dataset_id: 'd1',
    dataset_type: 'SINGLE',
    name: 'Retinol_vs_Vehicle',
    deg_up: 412,
    deg_down: 230,
    deg_total: 642,
    has_enrichment: true,
    updated_at: '2026-10-11T10:00:00Z',
  },
  {
    project_id: 'p1',
    project_name: 'Skin Study',
    dataset_name: 'DESeq2',
    dataset_id: 'd1',
    dataset_type: 'SINGLE',
    name: 'UVB_vs_Sham',
    deg_up: 120,
    deg_down: 640,
    deg_total: 760,
    has_enrichment: false,
    updated_at: '2026-10-10T10:00:00Z',
  },
];
let comparisons = COMPARISONS;
jest.mock('@/hooks/useAllComparisons', () => ({
  useAllComparisons: () => ({ data: { comparisons }, isLoading: false, isError: false }),
}));

jest.mock('@/hooks/useWorkspaceActivity', () => ({
  useWorkspaceActivity: () => ({
    isLoading: false,
    items: [
      {
        id: 'e1',
        project_id: 'p1',
        project_name: 'Skin Study',
        user_id: 'me',
        event_type: 'dataset_uploaded',
        entity_name: 'counts.tsv',
        extra_metadata: {},
        created_at: '2026-10-11T09:00:00Z',
      },
      {
        id: 'e2',
        project_id: 'p1',
        project_name: 'Skin Study',
        user_id: 'someone-else',
        event_type: 'comment_added',
        entity_type: 'comparison',
        entity_name: 'UVB_vs_Sham',
        extra_metadata: {},
        created_at: '2026-10-10T09:00:00Z',
      },
    ],
  }),
}));

// Palette fixe : la vraie lit le theme et le mode daltonien.
jest.mock('@/utils/chartTheme', () => ({
  useChartPalette: () => ({ up: '#0a0', down: '#a00' }),
}));

const openChatWith = jest.fn();
jest.mock('@/contexts/ChatModeContext', () => ({
  useChatMode: () => ({ openChatWith }),
}));

// Les enfants qui ne participent pas a la composition sont neutralises.
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

const projectListSpy = jest.fn();
jest.mock('@/components/ProjectList', () => ({
  __esModule: true,
  default: () => {
    projectListSpy();
    return <div data-testid="project-grid" />;
  },
}));

beforeEach(() => {
  projects = PROJECTS;
  comparisons = COMPARISONS;
  profile = { id: 'u1', role: 'USER', subscription_plan: 'STARTER' };
  projectLimit = { blocked: false };
  openChatWith.mockClear();
  projectListSpy.mockClear();
});

// ── ordre de la page ──────────────────────────────────────────────────────

it('orders the page: work first, the account last', () => {
  const { container } = render(<Dashboard />);

  const order = Array.from(
    container.querySelectorAll(
      [
        '[data-tour="dashboard-welcome"]',
        '[data-tour="dashboard-kpis"]',
        '#latest-results-title',
        '#quick-actions-title',
        '#recent-projects-title',
        '#activity-title',
        '[data-tour="dashboard-plan"]',
      ].join(', '),
    ),
  ).map((el) => el.getAttribute('data-tour') ?? el.id);

  expect(order).toEqual([
    'dashboard-welcome',
    'dashboard-kpis',
    'latest-results-title',
    'quick-actions-title',
    'recent-projects-title',
    'activity-title',
    'dashboard-plan',
  ]);
});

it('keeps every tour anchor the registry points at', () => {
  const { container } = render(<Dashboard />);
  for (const key of ['dashboard-welcome', 'dashboard-kpis', 'dashboard-plan', 'dashboard-new-project']) {
    expect(container.querySelector(`[data-tour="${key}"]`)).toBeInTheDocument();
  }
});

it('keeps the plan and its quota meters together', () => {
  render(<Dashboard />);
  const plan = document.querySelector('[data-tour="dashboard-plan"]') as HTMLElement;
  expect(within(plan).getByTestId('plan-card')).toBeInTheDocument();
  expect(within(plan).getByTestId('quota-analyses')).toBeInTheDocument();
});

it('no longer renders the full project grid, and links to it instead', () => {
  render(<Dashboard />);
  expect(screen.queryByTestId('project-grid')).not.toBeInTheDocument();
  expect(projectListSpy).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/projects');
});

// ── chiffres du compte ────────────────────────────────────────────────────

it('states each account total once, in the figures strip', () => {
  render(<Dashboard />);
  const strip = document.querySelector('[data-tour="dashboard-kpis"]') as HTMLElement;
  expect(within(strip).getByText('37')).toBeInTheDocument();
  expect(screen.getAllByText('37')).toHaveLength(1);
  expect(screen.getAllByText('2,921')).toHaveLength(1);
  expect(within(strip).getByText('Enriched pathways')).toBeInTheDocument();
});

it('never shows the 7-day activity count — a vanity metric', () => {
  render(<Dashboard />);
  expect(screen.queryByText('9')).not.toBeInTheDocument();
});

// ── en-tete : une seule action ────────────────────────────────────────────

it('offers a single resume action in the header when a project exists', () => {
  render(<Dashboard />);
  expect(screen.getByRole('link', { name: /resume skin study/i })).toHaveAttribute('href', '/projects/p1');
  expect(screen.queryByRole('link', { name: /read the guides/i })).not.toBeInTheDocument();
});

it('points a brand-new account at the documentation instead', () => {
  projects = { items: [] };
  comparisons = [];
  render(<Dashboard />);

  expect(screen.getByRole('link', { name: /read the guides/i })).toHaveAttribute('href', '/docs');
  expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
});

// ── derniers resultats, lies a l'helice ───────────────────────────────────

it('lists the latest results with a link to each comparison', () => {
  render(<Dashboard />);
  expect(screen.getByRole('link', { name: /retinol vs vehicle/i })).toHaveAttribute(
    'href',
    '/projects/p1/comparisons/Retinol_vs_Vehicle',
  );
  expect(screen.getByRole('link', { name: /all comparisons/i })).toHaveAttribute('href', '/comparisons');
});

it('marks a result as active while it has focus — the helix turns to it', () => {
  render(<Dashboard />);
  const row = screen.getByRole('link', { name: /uvb vs sham/i });

  fireEvent.focus(row);
  expect(row).toHaveAttribute('data-active');

  fireEvent.blur(row);
  expect(row).not.toHaveAttribute('data-active');
});

it('explains the empty state instead of drawing an empty list', () => {
  comparisons = [];
  render(<Dashboard />);
  expect(screen.getByText(/no results yet/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /start an analysis/i })).toHaveAttribute(
    'href',
    '/projects/p1/analyses/new',
  );
});

// ── actions rapides ───────────────────────────────────────────────────────

it('starts a new analysis in the most recent project', () => {
  render(<Dashboard />);
  expect(screen.getByRole('link', { name: /new analysis/i })).toHaveAttribute('href', '/projects/p1/analyses/new');
});

it('opens the AI on the latest comparison and says how many questions are left', () => {
  render(<Dashboard />);
  const ask = screen.getByRole('button', { name: /ask the ai/i });
  expect(ask).toHaveTextContent('18 left');

  fireEvent.click(ask);
  expect(openChatWith).toHaveBeenCalledWith({
    projectId: 'p1',
    datasetId: 'd1',
    comparisonName: 'Retinol_vs_Vehicle',
  });
});

it('disables the AI until there is a comparison to talk about', () => {
  comparisons = [];
  render(<Dashboard />);
  expect(screen.getByRole('button', { name: /ask the ai/i })).toBeDisabled();
});

// ── activite ──────────────────────────────────────────────────────────────

it('tells the user apart from collaborators in the activity feed', () => {
  render(<Dashboard />);
  const feed = screen.getByRole('heading', { name: 'Activity' }).closest('section') as HTMLElement;
  expect(within(feed).getByText(/uploaded/)).toHaveTextContent('You uploaded counts.tsv');
  expect(within(feed).getByText(/commented on/)).toHaveTextContent('A collaborator commented on UVB vs Sham');
});

// ── lecture cutanee ───────────────────────────────────────────────────────

it('keeps the skin read only for accounts with the cosmetics module', () => {
  const { unmount } = render(<Dashboard />);
  expect(screen.queryByTestId('jump-back-in')).not.toBeInTheDocument();
  unmount();

  profile = { ...profile, has_cosmetics_module: true };
  render(<Dashboard />);
  expect(screen.getByTestId('jump-back-in')).toBeInTheDocument();
});

// ── creation de projet ────────────────────────────────────────────────────

it('leaves project creation to the recent-projects header', () => {
  render(<Dashboard />);
  expect(screen.getAllByRole('button', { name: /new project/i })).toHaveLength(1);
});

it('leaves the create button usable below the limit', () => {
  render(<Dashboard />);
  expect(screen.getByRole('button', { name: /new project/i })).toBeEnabled();
});

it('disables the create button at the limit and says why', () => {
  projectLimit = { blocked: true, reason: 'Project limit reached (15/15). Upgrade your plan.' };
  render(<Dashboard />);

  const button = screen.getByRole('button', { name: /new project/i });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('title', 'Project limit reached (15/15). Upgrade your plan.');
});
