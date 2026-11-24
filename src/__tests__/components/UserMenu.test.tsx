/**
 * Regression : le « Sign out » du menu utilisateur est un `<form method="post">`
 * rendu conditionnellement derriere `{open && ...}`.
 *
 * Le bouton portait un `onClick={() => setOpen(false)}` comme les autres
 * entrees du menu. React purge les evenements discrets de facon synchrone : le
 * menu — et le form avec lui — quittait le DOM avant que le navigateur ne
 * declenche l'activation du submitter. Un submitter detache n'a plus de form
 * owner, donc la soumission etait abandonnee en silence et le bouton ne faisait
 * rien (reproduit dans un vrai navigateur ; jsdom n'implemente pas la
 * soumission, d'ou l'invariant teste ici : le form doit survivre au clic).
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import UserMenu from '@/components/sidebar/UserMenu';
import type { User } from '@supabase/supabase-js';

const toggleTheme = jest.fn();
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme }),
}));

const user = { id: 'u1', email: 'chercheur@example.com' } as User;

describe('UserMenu — sign out', () => {
  it('poste vers /auth/signout', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByRole('button', { name: /chercheur/i }));

    const form = screen.getByRole('menuitem', { name: /sign out/i }).closest('form');
    expect(form).toHaveAttribute('action', '/auth/signout');
    expect(form).toHaveAttribute('method', 'post');
  });

  it('ne demonte pas le form au clic, sinon la soumission est annulee', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByRole('button', { name: /chercheur/i }));

    const signOut = screen.getByRole('menuitem', { name: /sign out/i });
    fireEvent.click(signOut);

    expect(screen.getByRole('menuitem', { name: /sign out/i }).closest('form')).toBeInTheDocument();
  });

  it('ferme bien le menu depuis les autres entrees', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByRole('button', { name: /chercheur/i }));

    fireEvent.click(screen.getByRole('menuitem', { name: /profile/i }));
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
    render(<UserMenu user={user} />);
    expect(trigger()).toHaveTextContent(/^CH$/);
    expect(trigger()).toHaveClass('bg-plum', 'text-on-accent', 'h-9', 'w-9');
    // Le nom et le courriel ne sont plus affiches en permanence.
    expect(screen.queryByText('chercheur@example.com')).not.toBeInTheDocument();
  });

  it('names the account in its accessible name and announces a menu', () => {
    render(<UserMenu user={user} />);
    expect(trigger()).toHaveAccessibleName(/chercheur@example\.com/);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a 44px hit area around the 36px disc', () => {
    render(<UserMenu user={user} />);
    expect(trigger().className).toMatch(/after:-inset-1\b/);
  });

  it('opens downward, under the trigger, and says who is signed in', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(trigger());

    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('top-full');
    expect(menu).not.toHaveClass('bottom-full');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByText('chercheur@example.com')).toBeInTheDocument();
  });

  it('lists Profile, the theme toggle and Sign out, in that order', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(trigger());

    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['Profile', 'Light theme', 'Sign out']);
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('toggles the theme without closing the menu', () => {
    toggleTheme.mockClear();
    render(<UserMenu user={user} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: /light theme/i }));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on Escape and gives the focus back to the trigger', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes on a press outside', () => {
    render(<UserMenu user={user} />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('UserMenu — Admin entry', () => {
  const open = (role?: string | null) => {
    render(<UserMenu user={user} userRole={role} />);
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
