/**
 * The Analyses page's launch buttons.
 *
 * They pointed at `/projects/[id]/analyses/new`, a launcher whose submit hit
 * an endpoint that does not exist, so every launch from this page failed. They
 * now open the setup wizard, like the overview, and follow the same rule: only
 * the owner or an ADMIN member sees them.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@/hooks/useAutoTour', () => ({ useAutoTour: jest.fn() }));

let analyses: { id: string }[] = [];
jest.mock('@/hooks/useAnalyses', () => ({
  useAnalyses: () => ({ data: { items: analyses }, isLoading: false, isError: false }),
}));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' } }),
}));

let ownerId = 'u1';
jest.mock('@/hooks/useProjectData', () => ({
  useProjectSummary: () => ({ data: { project: { id: 'p1', owner_id: ownerId } } }),
  useProjectDatasets: () => ({ data: [] }),
}));

let members: { user_id: string; access_level: string }[] = [];
jest.mock('@/hooks/useProjectMembers', () => ({
  useProjectMembers: () => ({ data: { members } }),
}));

jest.mock('@/components/analyses/AnalysisStatusCard', () => ({ __esModule: true, default: () => null }));

import AnalysesListView from '@/components/analyses/AnalysesListView';

beforeEach(() => {
  analyses = [];
  ownerId = 'u1';
  members = [];
});

describe('Analyses page launch buttons', () => {
  it('points « New analysis » at the setup wizard', () => {
    analyses = [{ id: 'a1' }];
    render(<AnalysesListView projectId="p1" />);

    expect(screen.getByRole('link', { name: /new analysis/i })).toHaveAttribute(
      'href',
      '/projects/p1/setup',
    );
  });

  it('points the empty-state link at the setup wizard', () => {
    render(<AnalysesListView projectId="p1" />);

    expect(screen.getByRole('link', { name: /launch your first analysis/i })).toHaveAttribute(
      'href',
      '/projects/p1/setup',
    );
  });

  it('never links to the removed /analyses/new launcher', () => {
    render(<AnalysesListView projectId="p1" />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/\/analyses\/new/);
    }
  });

  it('shows the buttons to an ADMIN member', () => {
    ownerId = 'someone-else';
    members = [{ user_id: 'u1', access_level: 'ADMIN' }];
    render(<AnalysesListView projectId="p1" />);

    expect(screen.getByRole('link', { name: /new analysis/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /launch your first analysis/i })).toBeInTheDocument();
  });

  it('hides the buttons from a member without ADMIN access', () => {
    ownerId = 'someone-else';
    members = [{ user_id: 'u1', access_level: 'VIEWER' }];
    render(<AnalysesListView projectId="p1" />);

    expect(screen.queryByRole('link', { name: /new analysis/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /launch your first analysis/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no analyses launched/i)).toBeInTheDocument();
  });
});
