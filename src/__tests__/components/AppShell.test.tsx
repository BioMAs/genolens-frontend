/**
 * La coquille authentifiee, une fois la sidebar remplacee par la barre du haut.
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ TopNav (sticky, 64px)                              │
 *   ├────────────────────────────────────────────────────┤
 *   │ main.app-content                                   │
 *   │   fil d'Ariane      ← premiere ligne               │
 *   │   {children}                                       │
 *   └────────────────────────────────────────────────────┘
 *
 * `AppShell` est un composant SERVEUR : on le rend ici tel quel, ses enfants
 * clients (TopNav, PageBreadcrumb) etant les vrais.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: () => '/docs/gsea',
}));
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ restartCurrentTour: jest.fn(), currentTourId: null }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));
jest.mock('@/components/QuotaDisplay', () => ({
  __esModule: true,
  default: () => null,
}));

import AppShell from '@/components/AppShell';

const USER = { id: 'u1', email: 'lea@scilicium.com' } as never;

function renderShell(userRole: string | null = null) {
  return render(
    <AppShell user={USER} userRole={userRole}>
      <h1>Page title</h1>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('stacks the top bar over the content, and nothing else', () => {
    const { container } = renderShell();
    const shell = container.querySelector('.app-shell') as HTMLElement;

    expect(Array.from(shell.children).map((el) => el.tagName)).toEqual(['HEADER', 'MAIN']);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(shell.querySelector('.app-sidebar, .app-main, .app-topbar')).toBeNull();
  });

  it('mounts the top bar with the three destinations', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Home',
      'Projects',
      'Tools',
    ]);
  });

  it('opens the content with the breadcrumb, then the page', () => {
    renderShell();
    const main = screen.getByRole('main');

    const [first, second] = Array.from(main.children) as HTMLElement[];
    expect(within(first).getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(second).toBe(screen.getByRole('heading', { level: 1, name: 'Page title' }));
  });

  it('puts the account banners above the breadcrumb, which stays on the title', () => {
    render(
      <AppShell user={USER} userRole={null} banners={<div role="alert">Demo account</div>}>
        <h1>Page title</h1>
      </AppShell>,
    );
    const [first, second, third] = Array.from(screen.getByRole('main').children) as HTMLElement[];
    expect(first).toBe(screen.getByRole('alert'));
    expect(within(second).getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(third).toBe(screen.getByRole('heading', { level: 1, name: 'Page title' }));
  });

  it('hands the user role down to the account menu', () => {
    renderShell('admin');
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
