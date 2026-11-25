/**
 * Le menu d'aide de la barre du haut.
 *
 * Il remplace le bouton qui rejouait la visite : l'aide a maintenant deux
 * entrees (rejouer la visite de la page, ouvrir la documentation), donc un menu.
 * La documentation n'est plus une destination de la barre — c'est ici qu'on la
 * retrouve, et elle y est TOUJOURS, y compris sur une route sans visite.
 *
 * L'ancre `data-tour="help-button"` que la visite du tableau de bord vise est
 * posee sur le DECLENCHEUR, pas sur « Take the tour » : l'entree n'existe dans
 * le DOM que menu ouvert, et driver.js doit pouvoir la trouver au repos.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import HelpMenu from '@/components/shell/HelpMenu';

const restartCurrentTour = jest.fn();
let currentTourId: string | null = 'dashboard';
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ restartCurrentTour, currentTourId, startTour: jest.fn() }),
}));

const trigger = () => screen.getByRole('button', { name: 'Help' });
const open = () => fireEvent.click(trigger());

beforeEach(() => {
  restartCurrentTour.mockClear();
  currentTourId = 'dashboard';
});

describe('HelpMenu — trigger', () => {
  it('is a menu button that carries the tour anchor', () => {
    render(<HelpMenu />);
    expect(trigger()).toHaveAttribute('data-tour', 'help-button');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('is always rendered, even on a route that has no tour', () => {
    currentTourId = null;
    render(<HelpMenu />);
    expect(trigger()).toHaveAttribute('data-tour', 'help-button');
  });

  it('keeps a 44px hit target around the 36px button', () => {
    render(<HelpMenu />);
    expect(trigger()).toHaveClass('h-9', 'w-9');
    expect(trigger().className).toMatch(/after:-inset-1\b/);
  });

  it('lists nothing until it is opened', () => {
    render(<HelpMenu />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('HelpMenu — entries', () => {
  it('links Documentation to /docs', () => {
    render(<HelpMenu />);
    open();
    const docs = screen.getByRole('menuitem', { name: 'Documentation' });
    expect(docs).toHaveAttribute('href', '/docs');
  });

  it('offers the tour first, then the documentation, on a route that has a tour', () => {
    render(<HelpMenu />);
    open();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['Take the tour', 'Documentation']);
  });

  it('restarts the tour of the current page', () => {
    render(<HelpMenu />);
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Take the tour' }));
    expect(restartCurrentTour).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers only the documentation when the route has no tour', () => {
    currentTourId = null;
    render(<HelpMenu />);
    open();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['Documentation']);
    expect(screen.queryByRole('menuitem', { name: 'Take the tour' })).not.toBeInTheDocument();
  });

  it('closes on Escape and gives the focus back to the trigger', () => {
    render(<HelpMenu />);
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Le menu disparait avec l'element qui avait le focus : sans ce retour, un
    // utilisateur au clavier repart du haut du document.
    expect(trigger()).toHaveFocus();
  });
});
