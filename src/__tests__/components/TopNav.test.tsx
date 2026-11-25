/**
 * La barre du haut a trois destinations.
 *
 * L'assertion qui porte tout est l'etat actif, comme pour l'ancienne sidebar :
 * `/projects/{id}/…` et `/comparisons` appartiennent a Projects, et ni
 * `/docs` ni `/profile` ne doivent allumer de destination — la documentation
 * n'est plus une destination, elle vit dans le menu d'aide.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
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

function renderAt(pathname: string, userRole: string | null = null) {
  mockPathname = pathname;
  return render(<TopNav user={USER} userRole={userRole} />);
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

  it('mounts the search pill, the help menu, the quota and the account menu', () => {
    renderAt('/dashboard');
    expect(
      screen.getByRole('button', { name: 'Search genes, projects, comparisons' }),
    ).toBeInTheDocument();
    // Le menu d'aide a pris la place du bouton qui rejouait la visite : c'est
    // lui qui porte l'ancre que la visite du tableau de bord vise.
    expect(screen.getByRole('button', { name: 'Help' })).toHaveAttribute('data-tour', 'help-button');
    expect(screen.queryByRole('button', { name: 'Replay the guide' })).not.toBeInTheDocument();
    // Le solde IA est dans la barre (des 40rem) ET dans le tiroir (en dessous) :
    // le CSS n'en montre qu'un a la fois.
    const inBar = screen.getAllByTestId('quota').filter((q) => !q.closest('.app-drawer'));
    expect(inBar).toHaveLength(1);
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('opens the help menu on the tour and the documentation', () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('menuitem', { name: 'Take the tour' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
  });

  it('gives the account menu the role, so an admin gets the Admin entry', () => {
    const { unmount } = renderAt('/dashboard', 'admin');
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    unmount();

    renderAt('/dashboard', 'user');
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('puts the destination pills on the 36px control step, with a 44px hit area', () => {
    renderAt('/dashboard');
    for (const link of mainLinks()) {
      expect(link).toHaveClass('min-h-9');
      expect(link).not.toHaveClass('min-h-10');
      expect(link.className).toMatch(/after:-inset-y-1\b/);
    }
  });

  it('sets the wordmark on the title step of the type scale', () => {
    renderAt('/dashboard');
    const wordmark = screen.getByText('GenoLens', { selector: 'span' });
    expect(wordmark).toHaveClass('text-title');
  });

  it('is sticky, one row of the bar height, and never wraps onto a second row', () => {
    renderAt('/dashboard');
    const bar = screen.getByRole('banner');
    expect(bar).toHaveClass('sticky', 'top-0', 'z-40');
    // La hauteur vient du jeton, portee par la barre ET non par sa ligne
    // interieure (bordure comprise : 64px, pas 65) : `--sticky-top` (ou colle le
    // contenu) lui est egal, donc une barre qui passerait sur deux lignes ou
    // gagnerait un pixel decalerait tout.
    expect(bar).toHaveClass('h-[var(--topbar-height)]');
    const row = bar.firstElementChild as HTMLElement;
    expect(row).toHaveClass('h-full');
    expect(row).not.toHaveClass('flex-wrap');
  });

  it('is the page banner landmark', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});


/**
 * Sous 60rem les trois destinations et l'aide quittent la barre pour le tiroir
 * que `MobileNavToggle` ouvre. jsdom n'applique pas le CSS : les deux versions
 * sont dans le DOM, et c'est le CSS (`min-[60rem]:` / `.app-drawer`) qui montre
 * l'une ou l'autre. Ces tests verifient donc le CONTENU du tiroir et son
 * ouverture, pas sa visibilite.
 */
describe('TopNav — the drawer below 60rem', () => {
  const toggle = () => screen.getByRole('button', { name: /open navigation|close navigation/i });
  const drawer = () => screen.getByRole('navigation', { name: 'Menu' });

  it('puts the three destinations in the drawer, marking the current one', () => {
    renderAt('/projects/abc');
    const links = within(drawer()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Projects', 'Tools']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('does not repeat the Main landmark name, so the bar navigation stays unambiguous', () => {
    renderAt('/dashboard');
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('carries the help entries: the tour, then the documentation', () => {
    renderAt('/dashboard');
    const panel = drawer().closest('.app-drawer') as HTMLElement;
    expect(within(panel).getByRole('button', { name: 'Take the tour' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
  });

  it('opens and closes through the toggle, which owns the open state', () => {
    renderAt('/dashboard');
    const panel = drawer().closest('.app-drawer') as HTMLElement;
    expect(panel).toHaveAttribute('data-state', 'closed');

    fireEvent.click(toggle());
    expect(panel).toHaveAttribute('data-state', 'open');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle());
    expect(panel).toHaveAttribute('data-state', 'closed');
  });

  it('keeps the search pill in the bar, outside the drawer', () => {
    renderAt('/dashboard');
    const panel = drawer().closest('.app-drawer') as HTMLElement;
    const pill = screen.getByRole('button', { name: 'Search genes, projects, comparisons' });
    expect(panel.contains(pill)).toBe(false);
  });

  it('says what the search pill searches, in its visible text as in its accessible name', () => {
    renderAt('/dashboard');
    const pill = screen.getByRole('button', { name: 'Search genes, projects, comparisons' });
    // Le libelle visible est le nom accessible (etiquette dans le nom, WCAG 2.5.3) :
    // un utilisateur de commande vocale dit ce qu'il lit.
    expect(pill).toHaveTextContent('Search genes, projects, comparisons');
    expect(pill).toHaveTextContent('⌘K');
    expect(pill).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });
});
