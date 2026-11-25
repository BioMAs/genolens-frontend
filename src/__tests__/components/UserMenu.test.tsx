/**
 * Menu utilisateur du pied de sidebar : ouverture, entrees, deconnexion.
 *
 * La deconnexion ne passe plus par un `<form method="post">` vers une route
 * Next : le cookie de renouvellement n'est visible que de l'API, donc c'est le
 * navigateur qui termine la session (`signOut`) et recoit l'effacement des
 * cookies. Ce test ne verifie que le branchement ; l'appel et la navigation
 * sont couverts dans `clientBrowser.test.ts`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from '@/components/sidebar/UserMenu';
import { signOut } from '@/utils/auth/client';
import type { AppUser } from '@/utils/auth/types';

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

jest.mock('@/utils/auth/client', () => ({ signOut: jest.fn() }));

const account: AppUser = {
  id: 'u1',
  email: 'lea@example.test',
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
