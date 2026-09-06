/**
 * The Workspace group of the side nav.
 *
 * The load-bearing assertion is the active state. `isActive` used to be a plain
 * `startsWith`, which lit up "Projects" on every `/projects/{id}/…` route — the
 * very routes the Project group below is there to own. A nav where two groups
 * claim the same page is worse than a nav with two items.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';

let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useProjects', () => ({
  useProject: () => ({ data: { name: 'Skin Study' } }),
}));

jest.mock('@/hooks/useAddOnModules', () => ({
  useScientificModule: () => ({ unlocked: true }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('@/components/QuotaDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="quota" />,
}));

jest.mock('@/components/comparison/ComparisonSidebarNav', () => ({
  __esModule: true,
  default: () => <div data-testid="comparison-nav" />,
}));

import Sidebar from '@/components/Sidebar';

const USER = { email: 'lea@scilicium.com' } as never;

function renderAt(pathname: string, userRole: string | null = null) {
  mockPathname = pathname;
  return render(<Sidebar user={USER} userRole={userRole} />);
}

/** The Workspace group, located by the tour anchor the sidebar already carries. */
function workspaceGroup(): HTMLElement {
  const group = document.querySelector('[data-tour="sidebar-workspace"]');
  if (!group) throw new Error('Workspace nav group not found');
  return group as HTMLElement;
}

/** The nav link carrying this exact label inside the Workspace group. */
function workspaceLink(label: string): HTMLElement {
  return within(workspaceGroup()).getByRole('link', { name: label });
}

beforeEach(() => {
  mockPathname = '/dashboard';
});

describe('Workspace navigation', () => {
  it('offers the four workspace destinations', () => {
    renderAt('/dashboard');
    const group = workspaceGroup();

    expect(within(group).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual([
      'Dashboard',
      'Projects',
      'Comparisons',
      'Tools',
    ]);
  });

  it('points each item at its own route', () => {
    renderAt('/dashboard');

    expect(workspaceLink('Dashboard')).toHaveAttribute('href', '/dashboard');
    expect(workspaceLink('Projects')).toHaveAttribute('href', '/projects');
    expect(workspaceLink('Comparisons')).toHaveAttribute('href', '/comparisons');
    expect(workspaceLink('Tools')).toHaveAttribute('href', '/tools');
  });
});

describe('active state', () => {
  it('marks Projects active on the projects list', () => {
    renderAt('/projects');
    expect(workspaceLink('Projects').className).toContain('active');
  });

  it('marks Comparisons active on the comparisons list', () => {
    renderAt('/comparisons');
    expect(workspaceLink('Comparisons').className).toContain('active');
    expect(workspaceLink('Dashboard').className).not.toContain('active');
  });

  it.each([
    '/projects/abc',
    '/projects/abc/analyses',
    '/projects/abc/comparisons/A_vs_B',
  ])('leaves Projects inactive inside a project (%s)', (pathname) => {
    renderAt(pathname);
    expect(workspaceLink('Projects').className).not.toContain('active');
  });

  it('renders the Project group instead once inside a project', () => {
    renderAt('/projects/abc/analyses');

    expect(document.querySelector('[data-tour="sidebar-project"]')).toBeInTheDocument();
    expect(screen.getByText('Skin Study')).toBeInTheDocument();
  });

  it('keeps Tools active on its sub-routes', () => {
    renderAt('/tools/ontology');
    expect(workspaceLink('Tools').className).toContain('active');
  });

  it('does not treat a sibling route as a Tools sub-route', () => {
    renderAt('/toolsmith');
    expect(workspaceLink('Tools').className).not.toContain('active');
  });
});
