/**
 * `/auth/refresh` is where the middleware sends a visitor whose access token
 * has expired but whose session hint survives. It renews silently, then goes
 * back where the visitor was heading, with a full navigation (the root layout
 * picks its shell on the server).
 *
 * `next/navigation`, the renewal and the navigation seam are simulated.
 */
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import RefreshPage from '@/app/auth/refresh/page';
import { refreshSession } from '@/utils/auth/client';
import { replaceLocation } from '@/utils/auth/navigation';

let query = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
jest.mock('@/utils/auth/client', () => ({ refreshSession: jest.fn() }));
jest.mock('@/utils/auth/navigation', () => ({ replaceLocation: jest.fn(), navigate: jest.fn() }));

const renew = refreshSession as jest.MockedFunction<typeof refreshSession>;
const replace = replaceLocation as jest.MockedFunction<typeof replaceLocation>;

const search = (value: string) => {
  query = value;
};

beforeEach(() => {
  renew.mockReset();
  replace.mockReset();
  search('');
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = 'https://admin.example.test';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
});

it('says what it is doing while it renews', async () => {
  renew.mockReturnValue(new Promise(() => {}));

  render(<RefreshPage />);

  expect(screen.getByText(/restoring your session/i)).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it('resumes navigation after a renewal', async () => {
  search('?next=%2Fprojects');
  renew.mockResolvedValue(true);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/projects'));
});

it('goes back to the admin app when that is where the visitor was heading', async () => {
  search('?next=https%3A%2F%2Fadmin.example.test%2Fusers');
  renew.mockResolvedValue(true);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('https://admin.example.test/users'));
});

it('ignores a foreign next', async () => {
  search('?next=https%3A%2F%2Fevil.test');
  renew.mockResolvedValue(true);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
});

it('goes to the dashboard when there is no next', async () => {
  renew.mockResolvedValue(true);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
});

it('falls back to the login page, marked so the middleware does not loop', async () => {
  search('?next=%2Fprojects');
  renew.mockResolvedValue(false);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/?next=%2Fprojects&reauth=1'));
});

it('does not hand a foreign next on to the login page', async () => {
  search('?next=%2F%2Fevil.test');
  renew.mockResolvedValue(false);

  render(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/?next=%2Fdashboard&reauth=1'));
});

it('renews once, however many times it is rendered', async () => {
  renew.mockResolvedValue(true);

  const { rerender } = render(<RefreshPage />);
  rerender(<RefreshPage />);

  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  expect(renew).toHaveBeenCalledTimes(1);
});

it('navigates once under StrictMode, which runs the effect twice', async () => {
  search('?next=%2Fprojects');
  renew.mockResolvedValue(true);

  render(
    <StrictMode>
      <RefreshPage />
    </StrictMode>,
  );

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/projects'));
  await Promise.resolve();
  expect(replace).toHaveBeenCalledTimes(1);
});
