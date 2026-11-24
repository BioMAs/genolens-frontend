/**
 * La barre du haut a trois destinations.
 *
 * L'assertion qui porte tout est l'etat actif, comme pour l'ancienne sidebar :
 * `/projects/{id}/…` et `/comparisons` appartiennent a Projects, et ni
 * `/docs` ni `/profile` ne doivent allumer de destination — la documentation
 * n'est plus une destination, elle vit dans le menu d'aide.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';

let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({
    restartCurrentTour: jest.fn(),
    currentTourId: 'dashboard',
  }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('@/components/QuotaDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="quota" />,
}));

import { DESTINATIONS, resolveActiveDestination } from '@/lib/navigation/destinations';
import TopNav from '@/components/shell/TopNav';

const USER = { email: 'lea@scilicium.com' } as never;

function renderAt(pathname: string) {
  mockPathname = pathname;
  return render(<TopNav user={USER} />);
}

/** Les trois liens de la navigation principale, dans l'ordre du DOM. */
function mainLinks(): HTMLElement[] {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  return within(nav).getAllByRole('link');
}

beforeEach(() => {
  mockPathname = '/dashboard';
});

describe('resolveActiveDestination', () => {
  it('maps the dashboard to home', () => {
    expect(resolveActiveDestination('/dashboard')).toBe('home');
  });

  it('keeps every project route under projects', () => {
    expect(resolveActiveDestination('/projects')).toBe('projects');
    expect(resolveActiveDestination('/projects/abc')).toBe('projects');
    expect(resolveActiveDestination('/projects/abc/analyses')).toBe('projects');
    expect(resolveActiveDestination('/projects/abc/analyses/x/comparisons/y')).toBe('projects');
  });

  it('files the cross-project comparisons list under projects', () => {
    expect(resolveActiveDestination('/comparisons')).toBe('projects');
    expect(resolveActiveDestination('/comparisons/abc')).toBe('projects');
  });

  it('maps the tools and their children to tools', () => {
    expect(resolveActiveDestination('/tools')).toBe('tools');
    expect(resolveActiveDestination('/tools/power-analysis')).toBe('tools');
  });

  it('lights no destination on routes that are not one', () => {
    expect(resolveActiveDestination('/docs')).toBeNull();
    expect(resolveActiveDestination('/docs/getting-started')).toBeNull();
    expect(resolveActiveDestination('/profile')).toBeNull();
    expect(resolveActiveDestination('/admin')).toBeNull();
    expect(resolveActiveDestination('/')).toBeNull();
    expect(resolveActiveDestination('')).toBeNull();
  });

  it('matches whole segments, not prefixes of a sibling route', () => {
    // Un simple startsWith allumerait Tools sur /toolsmith.
    expect(resolveActiveDestination('/toolsmith')).toBeNull();
    expect(resolveActiveDestination('/projects-archive')).toBeNull();
    expect(resolveActiveDestination('/dashboards')).toBeNull();
  });

  it('ignores a trailing slash', () => {
    expect(resolveActiveDestination('/projects/')).toBe('projects');
    expect(resolveActiveDestination('/dashboard/')).toBe('home');
  });

  it('does not resolve inherited object keys', () => {
    expect(resolveActiveDestination('/constructor')).toBeNull();
    expect(resolveActiveDestination('/__proto__')).toBeNull();
  });
});

describe('DESTINATIONS', () => {
  it('lists Home, Projects and Tools, in that order', () => {
    expect(DESTINATIONS).toEqual([
      { key: 'home', label: 'Home', href: '/dashboard' },
      { key: 'projects', label: 'Projects', href: '/projects' },
      { key: 'tools', label: 'Tools', href: '/tools' },
    ]);
  });
});

describe('TopNav', () => {
  it('has exactly three links in the main navigation', () => {
    renderAt('/dashboard');
    const links = mainLinks();
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Projects', 'Tools']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/dashboard', '/projects', '/tools']);
  });

  it('carries the tour anchor the dashboard tour targets', () => {
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveAttribute('data-tour', 'nav-workspace');
  });

  it('marks Projects as the current page on /projects/abc, and only Projects', () => {
    renderAt('/projects/abc');
    const links = mainLinks();
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('marks Home on /dashboard and Tools on /tools/power-analysis', () => {
    const { unmount } = renderAt('/dashboard');
    expect(mainLinks().map((l) => l.getAttribute('aria-current'))).toEqual(['page', null, null]);
    unmount();

    renderAt('/tools/power-analysis');
    expect(mainLinks().map((l) => l.getAttribute('aria-current'))).toEqual([null, null, 'page']);
  });

  it('marks Projects on the comparisons list', () => {
    renderAt('/comparisons');
    expect(mainLinks().map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('marks nothing on a route that is not a destination', () => {
    renderAt('/docs');
    for (const link of mainLinks()) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('styles the current link with the plum selection and the others at rest', () => {
    renderAt('/projects');
    const [home, projects] = mainLinks();
    expect(projects).toHaveClass('text-plum', 'bg-plum-soft');
    expect(home).toHaveClass('text-secondary');
    expect(home).not.toHaveClass('bg-plum-soft');
  });

  it('shows the brand as a link home, with the transparent mark and no white box', () => {
    renderAt('/projects');
    const brand = screen.getByRole('link', { name: 'GenoLens home' });
    expect(brand).toHaveAttribute('href', '/dashboard');
    expect(brand).toHaveTextContent('GenoLens');
    const img = brand.querySelector('img');
    expect(img).not.toBeNull();
    // logo.png a un fond blanc opaque : seul genolensLoupe.png est transparent.
    expect(decodeURIComponent(img?.getAttribute('src') ?? '')).toContain('genolensLoupe.png');
    expect(img?.getAttribute('src') ?? '').not.toContain('logo.png');
  });

  it('mounts the search pill, the guide button, the quota and the account menu', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'Open the command palette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay the guide' })).toHaveAttribute(
      'data-tour',
      'help-button',
    );
    expect(screen.getByTestId('quota')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lea/i })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('is the page banner landmark', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
