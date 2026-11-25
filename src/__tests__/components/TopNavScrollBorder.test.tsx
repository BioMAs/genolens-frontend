/**
 * Le filet de la barre du haut.
 *
 * La barre est collee en haut (`sticky`) et le CONTENU defile dessous : c'est le
 * document qui defile, pas un conteneur `.app-content`. L'ancienne barre de
 * contexte ecoutait ce conteneur ; elle ecoute maintenant la fenetre.
 *
 * Le filet est present au repos — la barre blanche est bordee d'un trait d'un
 * pixel, comme dans la maquette — et il se RENFORCE une fois la page defilee,
 * pour separer la barre de ce qui glisse dessous. Verrouille par un test et non
 * par une capture : le comportement depend d'un evenement de defilement.
 */
import { render, screen, act } from '@testing-library/react';

jest.mock('@/components/command/CommandPaletteTrigger', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/QuotaDisplay', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ restartCurrentTour: jest.fn(), currentTourId: 'dashboard' }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

import TopNav from '@/components/shell/TopNav';

const USER = { email: 'lea@scilicium.com' } as never;

const bar = () => screen.getByRole('banner');

/** Fait defiler la fenetre et notifie les ecouteurs. */
function scrollWindowTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

it('porte un filet discret au repos', () => {
  render(<TopNav user={USER} />);
  expect(bar()).toHaveClass('border-b', 'border-subtle');
  expect(bar()).not.toHaveClass('border-strong');
});

it('renforce le filet une fois la page défilée', () => {
  render(<TopNav user={USER} />);
  scrollWindowTo(120);

  expect(bar()).toHaveClass('border-strong');
  expect(bar()).not.toHaveClass('border-subtle');
});

it('revient au filet discret quand on remonte', () => {
  render(<TopNav user={USER} />);
  scrollWindowTo(120);
  scrollWindowTo(0);

  expect(bar()).toHaveClass('border-subtle');
  expect(bar()).not.toHaveClass('border-strong');
});

it("ne se déclenche pas sur un défilement d'un pixel", () => {
  // Un seuil est nécessaire : le rebond élastique de macOS produit des valeurs
  // de 1 ou 2px au repos, et le filet clignoterait.
  render(<TopNav user={USER} />);
  scrollWindowTo(2);

  expect(bar()).toHaveClass('border-subtle');
});

it('lit la position au montage, pour une page ouverte déjà défilée', () => {
  // Retour arriere du navigateur : la page est restauree a mi-hauteur avant
  // que la barre n'existe, donc aucun evenement `scroll` ne viendra.
  Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
  render(<TopNav user={USER} />);

  expect(bar()).toHaveClass('border-strong');
});

it("cesse d'écouter au démontage", () => {
  const remove = jest.spyOn(window, 'removeEventListener');
  const { unmount } = render(<TopNav user={USER} />);
  unmount();

  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  remove.mockRestore();
});
