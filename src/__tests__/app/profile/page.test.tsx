/**
 * `/profile` Server Component : lit le profil servi par l'API et deconnecte
 * par le navigateur.
 *
 * `/users/me` ne sert ni la date de creation du compte ni la derniere
 * connexion : ces deux lignes ont disparu (les sessions actives montrent la
 * derniere activite). Les sections du bas de page (modules, usage,
 * facturation) et la section Securite sont simulees : elles lisent l'API par
 * des hooks et n'ont rien a voir avec ce que ce test verifie.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/profile/page';
import { getServerUser } from '@/utils/auth/server';
import { signOut } from '@/utils/auth/client';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/utils/auth/server', () => ({ getServerUser: jest.fn() }));
jest.mock('@/utils/auth/client', () => ({ signOut: jest.fn() }));

jest.mock('@/app/profile/BillingSection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/profile/UsageSection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/profile/MyModules', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/profile/SecuritySection', () => ({
  __esModule: true,
  default: () => <div data-testid="security-section" />,
}));

import { redirect } from 'next/navigation';

const profile = getServerUser as jest.MockedFunction<typeof getServerUser>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('redirects a visitor without a session to the landing page', async () => {
  profile.mockResolvedValue(null);

  await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/');
});

it('names the account after its full name', async () => {
  profile.mockResolvedValue({
    id: 'u1',
    email: 'ada@example.test',
    full_name: 'Ada Example',
    role: 'USER',
  });

  render(await ProfilePage());

  expect(screen.getByRole('heading', { level: 1, name: 'Ada Example' })).toBeInTheDocument();
});

it('falls back to the local part of the e-mail address', async () => {
  profile.mockResolvedValue({ id: 'u1', email: 'lea@example.test', full_name: null, role: 'USER' });

  render(await ProfilePage());

  expect(screen.getByRole('heading', { level: 1, name: 'lea' })).toBeInTheDocument();
});

it('lists only what the API serves about the account', async () => {
  profile.mockResolvedValue({ id: 'u-42', email: 'lea@example.test', full_name: null, role: 'USER' });

  render(await ProfilePage());

  expect(screen.getByText('Email address')).toBeInTheDocument();
  expect(screen.getByText('u-42')).toBeInTheDocument();
  expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/last sign in/i)).not.toBeInTheDocument();
});

it('signs out through the API', async () => {
  profile.mockResolvedValue({ id: 'u1', email: 'lea@example.test', full_name: null, role: 'USER' });
  const user = userEvent.setup();

  render(await ProfilePage());
  await user.click(screen.getByRole('button', { name: /sign out/i }));

  expect(signOut).toHaveBeenCalledTimes(1);
});

it('shows the account security section', async () => {
  profile.mockResolvedValue({ id: 'u1', email: 'lea@example.test', full_name: null, role: 'USER' });

  render(await ProfilePage());

  expect(screen.getByTestId('security-section')).toBeInTheDocument();
});
