/**
 * The dashboard after the workspace reorganisation.
 *
 * Two things must hold at once: the full project grid is gone (it lives on
 * /projects now, and leaving both would mean two requests for one list), and
 * the `dashboard-new-project` tour anchor survived the move into the "Recent
 * projects" header — the onboarding tour points a step straight at it.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@/hooks/useAutoTour', () => ({ useAutoTour: jest.fn() }));
jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { name: 'Lea', email: 'lea@scilicium.com' } }),
}));
jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    data: {
      items: [
        { id: 'p1', name: 'Skin Study', updated_at: '2026-09-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z' },
      ],
    },
  }),
}));
jest.mock('@/hooks/useUserDashboardStats', () => ({
  useUserDashboardStats: () => ({
    aggregated: { total_comparisons: 4, activity_last_7_days: 2 },
    statsMap: {},
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    data: { max_projects: 10, project_count: 1 },
    isLoading: false,
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { ai_interpretations_used: 3 } }),
}));

// The dashboard's children each pull their own data; this suite is about the
// dashboard's own composition, so they are stubbed to their identity.
jest.mock('@/components/DashboardWelcomeBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="welcome-banner" />,
}));
jest.mock('@/components/DashboardKpiBar', () => ({
  __esModule: true,
  default: () => <div data-testid="kpi-bar" />,
}));
jest.mock('@/components/DashboardSubscriptionCard', () => ({
  __esModule: true,
  default: () => <div data-testid="plan-card" />,
}));
jest.mock('@/components/RecentProjectsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="recent-projects" />,
}));
jest.mock('@/components/dashboard/JumpBackInCard', () => ({
  __esModule: true,
  default: () => <div data-testid="jump-back-in" />,
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

import Dashboard from '@/components/Dashboard';

beforeEach(() => projectListSpy.mockClear());

describe('dashboard composition', () => {
  it('keeps the home-page blocks', () => {
    render(<Dashboard />);

    expect(screen.getByTestId('welcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('jump-back-in')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-bar')).toBeInTheDocument();
    expect(screen.getByTestId('recent-projects')).toBeInTheDocument();
    expect(screen.getByTestId('plan-card')).toBeInTheDocument();
  });

  it('no longer renders the full project grid', () => {
    render(<Dashboard />);

    expect(screen.queryByTestId('project-grid')).not.toBeInTheDocument();
    expect(projectListSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument();
  });

  it('sends the user to the dedicated projects page instead', () => {
    render(<Dashboard />);

    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/projects');
  });
});

describe('tour anchors', () => {
  it('still exposes dashboard-new-project after the button moved', () => {
    render(<Dashboard />);

    const anchor = document.querySelector('[data-tour="dashboard-new-project"]');
    expect(anchor).toBeInTheDocument();
    expect(anchor).toHaveTextContent(/new project/i);
  });

  it('keeps the welcome, kpi and plan anchors', () => {
    render(<Dashboard />);

    for (const key of ['dashboard-welcome', 'dashboard-kpis', 'dashboard-plan']) {
      expect(document.querySelector(`[data-tour="${key}"]`)).toBeInTheDocument();
    }
  });
});

describe('project limit', () => {
  it('leaves the create button usable below the limit', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /new project/i })).toBeEnabled();
  });
});
