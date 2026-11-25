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

const clearRenewedMarker = () => {
  document.cookie = 'gl_renewed=; Path=/; Max-Age=0';
};

beforeEach(() => {
  clearRenewedMarker();
  renew.mockReset();
  replace.mockReset();
  search('');
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = 'https://admin.example.test';
});

afterEach(() => {
  clearRenewedMarker();
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

describe('reached right after a renewal that did not help', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    document.cookie = 'gl_renewed=1; Path=/; Max-Age=30';
  });

  afterEach(() => {
    logged.mockRestore();
  });

  // The admin app sends its visitors here too, and cannot see this marker: the
  // page itself must refuse to renew a second time.
  it('does not renew again, and shows the sign-in form instead', async () => {
    search('?next=https%3A%2F%2Fadmin.example.test%2Fusers');
    renew.mockResolvedValue(true);

    render(<RefreshPage />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/?next=https%3A%2F%2Fadmin.example.test%2Fusers&reauth=1',
      ),
    );
    expect(renew).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('names the likely cause once', async () => {
    search('?next=%2Fprojects');

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(logged).toHaveBeenCalledTimes(1);
    const message = logged.mock.calls[0].map(String).join(' ');
    expect(message).toMatch(/AUTH_ISSUER/);
    expect(message).toMatch(/AUTH_JWKS_URL/);
    expect(message).toMatch(/cookie domain/i);
  });

  it('does not hand a foreign next on', async () => {
    search('?next=https%3A%2F%2Fevil.test');

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/?next=%2Fdashboard&reauth=1'));
  });

  it('is silent, and renews, when the marker is absent', async () => {
    clearRenewedMarker();
    renew.mockResolvedValue(true);

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(logged).not.toHaveBeenCalled();
  });
});

describe('the marker that stops a renewal loop', () => {
  it('is left behind by a renewal, before navigating', async () => {
    renew.mockResolvedValue(true);
    let seenAtNavigation = '';
    replace.mockImplementation(() => {
      seenAtNavigation = document.cookie;
    });

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(seenAtNavigation).toContain('gl_renewed=1');
  });

  it('is a short, page-wide cookie', async () => {
    renew.mockResolvedValue(true);
    const written = jest.spyOn(document, 'cookie', 'set');

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    // http here (jsdom's default): no `Secure`, which the browser would refuse.
    expect(written).toHaveBeenCalledWith('gl_renewed=1; Path=/; Max-Age=30; SameSite=Lax');
    written.mockRestore();
  });

  it('is not left behind by a refused renewal', async () => {
    renew.mockResolvedValue(false);

    render(<RefreshPage />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(document.cookie).not.toContain('gl_renewed');
  });
});
