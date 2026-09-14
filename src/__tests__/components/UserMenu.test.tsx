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
import { render, screen, fireEvent } from '@testing-library/react';
import UserMenu from '@/components/sidebar/UserMenu';
import type { User } from '@supabase/supabase-js';

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
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
