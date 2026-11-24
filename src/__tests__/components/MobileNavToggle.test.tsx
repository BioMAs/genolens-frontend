/**
 * L'ouverture du tiroir de navigation sous 60rem.
 *
 * Le bouton POSSEDE l'etat ouvert/ferme et rend le tiroir (le contenu lui est
 * passe en enfants). Trois regles, heritees de la sidebar-tiroir qu'il pilotait :
 * naviguer ferme le tiroir, Echap le ferme, un clic sur le voile le ferme. Une
 * quatrieme s'y ajoute avec le contenu : activer un lien ou un bouton DU tiroir
 * le ferme aussi, sinon « Take the tour » demarrerait la visite sous un tiroir
 * resté ouvert.
 */
import Link from 'next/link';
import { render, screen, fireEvent } from '@testing-library/react';

let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import MobileNavToggle from '@/components/MobileNavToggle';

const onTour = jest.fn();

function renderToggle() {
  return render(
    <MobileNavToggle>
      <nav aria-label="Menu">
        <Link href="/projects">Projects</Link>
        <button type="button" onClick={onTour}>
          Take the tour
        </button>
        <p>Not interactive</p>
      </nav>
    </MobileNavToggle>,
  );
}

const toggle = () => screen.getByRole('button', { name: /open navigation|close navigation/i });
const drawer = () => screen.getByRole('navigation', { name: 'Menu' }).closest('.app-drawer') as HTMLElement;
const scrim = () => document.querySelector('.mobile-nav-scrim');

beforeEach(() => {
  mockPathname = '/dashboard';
  onTour.mockClear();
});

describe('MobileNavToggle', () => {
  it('starts closed, with a named button that points at the drawer', () => {
    renderToggle();
    expect(toggle()).toHaveAccessibleName('Open navigation');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(drawer()).toHaveAttribute('data-state', 'closed');
    expect(toggle()).toHaveAttribute('aria-controls', drawer().id);
    expect(drawer().id).not.toBe('');
    expect(scrim()).toBeNull();
  });

  it('opens on click, showing the scrim', () => {
    renderToggle();
    fireEvent.click(toggle());

    expect(toggle()).toHaveAccessibleName('Close navigation');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(drawer()).toHaveAttribute('data-state', 'open');
    expect(scrim()).not.toBeNull();
  });

  it('closes on the scrim', () => {
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.click(scrim() as Element);

    expect(drawer()).toHaveAttribute('data-state', 'closed');
    expect(scrim()).toBeNull();
  });

  it('closes on Escape', () => {
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(drawer()).toHaveAttribute('data-state', 'closed');
  });

  it('closes when the route changes, so it does not hide the page just opened', () => {
    const { rerender } = renderToggle();
    fireEvent.click(toggle());
    expect(drawer()).toHaveAttribute('data-state', 'open');

    mockPathname = '/projects';
    rerender(
      <MobileNavToggle>
        <nav aria-label="Menu">
          <Link href="/projects">Projects</Link>
        </nav>
      </MobileNavToggle>,
    );

    expect(drawer()).toHaveAttribute('data-state', 'closed');
  });

  it('closes when a link of the drawer is activated, even to the page already open', () => {
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('link', { name: 'Projects' }));

    expect(drawer()).toHaveAttribute('data-state', 'closed');
  });

  it('closes when a button of the drawer is activated, after the button has acted', () => {
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Take the tour' }));

    expect(onTour).toHaveBeenCalledTimes(1);
    expect(drawer()).toHaveAttribute('data-state', 'closed');
  });

  it('stays open when the click lands on something that is not a control', () => {
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByText('Not interactive'));

    expect(drawer()).toHaveAttribute('data-state', 'open');
  });

  it('hands the page back its keyboard: no Escape listener left behind once closed', () => {
    const remove = jest.spyOn(document, 'removeEventListener');
    renderToggle();
    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
    remove.mockRestore();
  });
});
