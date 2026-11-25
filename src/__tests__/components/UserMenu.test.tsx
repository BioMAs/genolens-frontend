/**
 * Menu du compte de la barre du haut : ouverture, entrees, deconnexion.
 *
 * La deconnexion ne passe plus par un `<form method="post">` vers une route
 * Next : le cookie de renouvellement n'est visible que de l'API, donc c'est le
 * navigateur qui termine la session (`signOut`) et recoit l'effacement des
 * cookies. Ce test ne verifie que le branchement ; l'appel et la navigation
 * sont couverts dans `clientBrowser.test.ts`.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from '@/components/sidebar/UserMenu';
import { signOut } from '@/utils/auth/client';
import type { AppUser } from '@/utils/auth/types';

const toggleTheme = jest.fn();
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme }),
}));

jest.mock('@/utils/auth/client', () => ({ signOut: jest.fn() }));

const account: AppUser = {
  id: 'u1',
  email: 'lea@example.test',
  full_name: null,
  role: 'USER',
};

/** Le compte des tests de la barre du haut : ses initiales sont « CH ». */
const researcher: AppUser = {
  id: 'u2',
  email: 'chercheur@example.com',
  full_name: null,
  role: 'USER',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserMenu', () => {
  it('signs out through the API', async () => {
    const user = userEvent.setup();
    render(<UserMenu user={account} />);
    await user.click(screen.getByRole('button', { name: /lea/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('offers sign-out as a button, not a form post to a route', async () => {
    const user = userEvent.setup();
    render(<UserMenu user={account} />);
    await user.click(screen.getByRole('button', { name: /lea/i }));

    const item = screen.getByRole('menuitem', { name: /sign out/i });
    expect(item.tagName).toBe('BUTTON');
    expect(item.closest('form')).toBeNull();
  });

  it('closes the menu from the other entries', async () => {
    const user = userEvent.setup();
    render(<UserMenu user={account} />);
    await user.click(screen.getByRole('button', { name: /lea/i }));

    // The profile entry is a link: left alone, jsdom would report a navigation
    // it does not implement.
    const profile = screen.getByRole('menuitem', { name: /profile/i });
    profile.addEventListener('click', (event) => event.preventDefault());
    await user.click(profile);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the menu on Escape', async () => {
    const user = userEvent.setup();
    render(<UserMenu user={account} />);
    await user.click(screen.getByRole('button', { name: /lea/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

/**
 * Le menu du compte dans la barre du haut.
 *
 * Il n'est plus une rangee de pied de sidebar de 56px : c'est une pastille
 * d'initiales de 36px qui s'ouvre VERS LE BAS (la barre est en haut de la page,
 * un menu qui s'ouvrirait vers le haut sortirait de l'ecran).
 */
describe('UserMenu — compact trigger in the top bar', () => {
  const trigger = () => screen.getByRole('button', { name: /account menu/i });

  it('shows the initials on a plum fill, with the on-accent text, and nothing else', () => {
    render(<UserMenu user={researcher} />);
    expect(trigger()).toHaveTextContent(/^CH$/);
    expect(trigger()).toHaveClass('bg-plum', 'text-on-accent', 'h-9', 'w-9');
    // Le nom et le courriel ne sont plus affiches en permanence.
    expect(screen.queryByText('chercheur@example.com')).not.toBeInTheDocument();
  });

  it('names the account in its accessible name and announces a menu', () => {
    render(<UserMenu user={researcher} />);
    expect(trigger()).toHaveAccessibleName(/chercheur@example\.com/);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a 44px hit area around the 36px disc', () => {
    render(<UserMenu user={researcher} />);
    expect(trigger().className).toMatch(/after:-inset-1\b/);
  });

  it('opens downward, under the trigger, and says who is signed in', () => {
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());

    const menu = screen.getByRole('menu');
    const popover = menu.parentElement as HTMLElement;
    expect(popover).toHaveClass('top-full');
    expect(popover).not.toHaveClass('bottom-full');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(popover).getByText('chercheur@example.com')).toBeInTheDocument();
  });

  it('keeps the identity beside the menu, not inside it', () => {
    // Un role="menu" ne contient que des entrees : un bloc de texte dedans est
    // annonce comme un element du menu qu'on ne peut pas activer (axe,
    // aria-required-children).
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());
    expect(within(screen.getByRole('menu')).queryByText('chercheur@example.com')).toBeNull();
  });

  it('never gets wider than the screen, whatever the e-mail', () => {
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());
    expect((screen.getByRole('menu').parentElement as HTMLElement).className).toMatch(
      /max-w-\[calc\(100vw-2rem\)\]/,
    );
  });

  it('lists Profile, the theme toggle and Sign out, in that order', () => {
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());

    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['Profile', 'Light theme', 'Sign out']);
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('toggles the theme without closing the menu', () => {
    toggleTheme.mockClear();
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: /light theme/i }));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on Escape and gives the focus back to the trigger', () => {
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes on a press outside', () => {
    render(<UserMenu user={researcher} />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('UserMenu — Admin entry', () => {
  const open = (role?: string | null) => {
    render(<UserMenu user={researcher} userRole={role} />);
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
  };

  it('shows Admin, linking to /admin, for an admin', () => {
    open('admin');
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('reads the role case-insensitively, as the sidebar did', () => {
    open('ADMIN');
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toBeInTheDocument();
  });

  it('places Admin between the theme toggle and Sign out', () => {
    open('admin');
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['Profile', 'Light theme', 'Admin', 'Sign out']);
  });

  it.each([['user'], [null], [undefined], ['']])('has no Admin entry for a role of %p', (role) => {
    open(role);
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('closes the menu from the Admin entry like from the other links', () => {
    open('admin');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Admin' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
