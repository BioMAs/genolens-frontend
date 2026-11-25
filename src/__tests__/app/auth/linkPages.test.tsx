/**
 * The pages opened from an e-mailed link: choose a new password (`/auth/reset`),
 * accept an invitation (`/auth/invite`), confirm an address
 * (`/auth/verify-email`), plus `/auth/forgot` that sends the reset link.
 *
 * The token rides in the fragment, or in the query string of a link sent
 * before it moved there. It is read once, at mount, and taken out of the
 * address bar; nothing is sent to the API before the visitor acts (a link
 * scanner that merely opens the page must not confirm anything).
 *
 * The auth client and the navigation seam are simulated. jsdom cannot stub
 * `window.location`, so each test sets the URL with the real
 * `history.replaceState` and the pages are observed through a spy on it.
 */
import { StrictMode } from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ForgotPage from '@/app/auth/forgot/page';
import InvitePage from '@/app/auth/invite/page';
import ResetPage from '@/app/auth/reset/page';
import VerifyEmailPage from '@/app/auth/verify-email/page';
import { useLinkToken } from '@/hooks/useLinkToken';
import {
  acceptInvite,
  forgotPassword,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/utils/auth/client';
import { navigate } from '@/utils/auth/navigation';
import { authOk, authRefused } from '@/test-utils/authResults';

jest.mock('@/utils/auth/client', () => ({
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  acceptInvite: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

const forgotMock = forgotPassword as jest.MockedFunction<typeof forgotPassword>;
const resetMock = resetPassword as jest.MockedFunction<typeof resetPassword>;
const inviteMock = acceptInvite as jest.MockedFunction<typeof acceptInvite>;
const verifyMock = verifyEmail as jest.MockedFunction<typeof verifyEmail>;
const resendMock = resendVerification as jest.MockedFunction<typeof resendVerification>;
const assign = navigate as jest.MockedFunction<typeof navigate>;

// Taken before any spy exists: the way a test moves the (real) jsdom URL.
const realReplaceState = window.history.replaceState.bind(window.history);
const setLocation = (url: string) => realReplaceState(null, '', url);

let replaceState: jest.SpyInstance;
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  jest.resetAllMocks();
  user = userEvent.setup();
  setLocation('/');
  replaceState = jest.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  replaceState.mockRestore();
});

const INVALID_LINK = /this link is invalid or has expired/i;
const PASSWORD = 'a-long-new-password';

async function typePasswords(submit: RegExp | string, password: string, confirm: string) {
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: submit }));
}

describe('useLinkToken', () => {
  it('hands back the token of the fragment and takes it out of the address bar', () => {
    setLocation('/auth/reset?other=1#a=1&token=abc');

    const { result } = renderHook(() => useLinkToken());

    expect(result.current).toBe('abc');
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
  });

  it('still reads a link sent with the token in the query string', () => {
    setLocation('/auth/reset?token=abc&other=1#frag');

    const { result } = renderHook(() => useLinkToken());

    expect(result.current).toBe('abc');
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('prefers the fragment when both carry a token, and removes both', () => {
    setLocation('/auth/reset?token=from-query#token=from-fragment');

    const { result } = renderHook(() => useLinkToken());

    expect(result.current).toBe('from-fragment');
    expect(window.location.href).not.toContain('from-');
  });

  it('decodes a URL-encoded token', () => {
    setLocation('/auth/reset#token=a%2Bb%2Fc%3D');

    const { result } = renderHook(() => useLinkToken());

    expect(result.current).toBe('a+b/c=');
  });

  it.each(['/auth/reset', '/auth/reset#top', '/auth/reset?tab=2#tokens=1'])(
    'answers null for a link without a token (%s), and leaves the URL alone',
    (url) => {
      setLocation(url);

      const { result } = renderHook(() => useLinkToken());

      expect(result.current).toBeNull();
      expect(replaceState).not.toHaveBeenCalled();
    },
  );

  it.each(['/auth/reset#token=', '/auth/reset?token=', '/auth/reset?token=#token='])(
    'treats an empty token as no token (%s)',
    (url) => {
      setLocation(url);

      const { result } = renderHook(() => useLinkToken());

      expect(result.current).toBeNull();
    },
  );

  it('falls back to the query string when the fragment token is empty', () => {
    setLocation('/auth/reset?token=abc#token=');

    const { result } = renderHook(() => useLinkToken());

    expect(result.current).toBe('abc');
    expect(window.location.href).not.toContain('abc');
  });

  it('keeps the token when React runs the effect twice (StrictMode)', () => {
    setLocation('/auth/reset#token=abc');

    const { result } = renderHook(() => useLinkToken(), { wrapper: StrictMode });

    // The second run finds an address bar without a token: it must not erase it.
    expect(result.current).toBe('abc');
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});

describe('/auth/reset', () => {
  it.each(['/auth/reset#token=abc', '/auth/reset?token=abc'])(
    'reads the token of %s once and removes it from the address bar',
    async (url) => {
      setLocation(url);
      resetMock.mockResolvedValue(authOk(null, 204));
      render(<ResetPage />);

      expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset');
      expect(window.location.href).not.toContain('abc');

      await typePasswords(/update password/i, PASSWORD, PASSWORD);
      expect(resetMock).toHaveBeenCalledWith('abc', PASSWORD);
    },
  );

  it('resets the password and asks to sign in', async () => {
    setLocation('/auth/reset#token=abc');
    resetMock.mockResolvedValue(authOk(null, 204));
    render(<ResetPage />);

    await typePasswords(/update password/i, PASSWORD, PASSWORD);

    expect(resetMock).toHaveBeenCalledWith('abc', PASSWORD);
    expect(
      await screen.findByText(
        'Your password has been changed. Sign in with your new password.',
      ),
    ).toBeInTheDocument();
    // No session is opened (every session was revoked): the way on is the sign-in page.
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/');
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('refuses mismatched passwords without calling the API', async () => {
    setLocation('/auth/reset#token=abc');
    render(<ResetPage />);

    await typePasswords(/update password/i, PASSWORD, 'another-long-pass');

    expect(resetMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Both passwords must match.');
  });

  it('refuses a password that is too short without calling the API', async () => {
    setLocation('/auth/reset#token=abc');
    render(<ResetPage />);

    await typePasswords(/update password/i, 'too-short', 'too-short');

    expect(resetMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 12 characters.');
  });

  it('shows the API reason for a refused password and lets the visitor try again', async () => {
    setLocation('/auth/reset#token=abc');
    resetMock.mockResolvedValueOnce(authRefused(400, 'password_policy:too_common'));
    resetMock.mockResolvedValueOnce(authOk(null, 204));
    render(<ResetPage />);

    await typePasswords(/update password/i, 'password1234', 'password1234');
    expect(await screen.findByRole('alert')).toHaveTextContent(/too common/i);

    // The form is still there, usable, and the token is still the one from the link.
    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await typePasswords(/update password/i, PASSWORD, PASSWORD);

    expect(resetMock).toHaveBeenLastCalledWith('abc', PASSWORD);
    expect(await screen.findByText(/sign in with your new password/i)).toBeInTheDocument();
  });

  it('sends a dead link to the request page', async () => {
    setLocation('/auth/reset#token=old');
    resetMock.mockResolvedValue(authRefused(400, 'invalid_token'));
    render(<ResetPage />);

    await typePasswords(/update password/i, PASSWORD, PASSWORD);

    expect(await screen.findByText(INVALID_LINK)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/auth/forgot',
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('says the link is invalid, and asks nothing, when the URL carries no token', () => {
    setLocation('/auth/reset');

    render(<ResetPage />);

    expect(screen.getByText(INVALID_LINK)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/auth/forgot',
    );
  });

  it('works under StrictMode: the form is shown, not the dead link', async () => {
    setLocation('/auth/reset#token=abc');
    resetMock.mockResolvedValue(authOk(null, 204));
    render(
      <StrictMode>
        <ResetPage />
      </StrictMode>,
    );

    await typePasswords(/update password/i, PASSWORD, PASSWORD);

    expect(resetMock).toHaveBeenCalledWith('abc', PASSWORD);
  });
});

describe('/auth/invite', () => {
  it('continues an invitation to the enrolment', async () => {
    setLocation('/auth/invite#token=inv');
    inviteMock.mockResolvedValue(authOk({ next: 'mfa_setup' as const }));
    render(<InvitePage />);

    await typePasswords(/set password/i, PASSWORD, PASSWORD);

    expect(inviteMock).toHaveBeenCalledWith('inv', PASSWORD);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/2fa/setup'));
  });

  it('continues an invitation of an account that already has a second factor to the code step', async () => {
    setLocation('/auth/invite#token=inv');
    inviteMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    render(<InvitePage />);

    await typePasswords(/set password/i, PASSWORD, PASSWORD);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/?step=mfa'));
  });

  it.each(['/auth/invite#token=inv', '/auth/invite?token=inv'])(
    'removes the token of %s from the address bar and keeps it for the form',
    async (url) => {
      setLocation(url);
      inviteMock.mockResolvedValue(authOk({ next: 'mfa_setup' as const }));
      render(<InvitePage />);

      expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/invite');
      expect(window.location.hash).toBe('');
      expect(window.location.search).toBe('');

      await typePasswords(/set password/i, PASSWORD, PASSWORD);
      expect(inviteMock).toHaveBeenCalledWith('inv', PASSWORD);
    },
  );

  it('refuses mismatched passwords without calling the API', async () => {
    setLocation('/auth/invite#token=inv');
    render(<InvitePage />);

    await typePasswords(/set password/i, PASSWORD, 'another-long-pass');

    expect(inviteMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Both passwords must match.');
  });

  it('shows the API reason for a refused password and stays on the page', async () => {
    setLocation('/auth/invite#token=inv');
    inviteMock.mockResolvedValue(authRefused(400, 'password_policy:too_common'));
    render(<InvitePage />);

    await typePasswords(/set password/i, 'password1234', 'password1234');

    expect(await screen.findByRole('alert')).toHaveTextContent(/too common/i);
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /set password/i })).toBeEnabled();
  });

  it('says so when the invitation is no longer valid', async () => {
    setLocation('/auth/invite#token=old');
    inviteMock.mockResolvedValue(authRefused(400, 'invalid_token'));
    render(<InvitePage />);

    await typePasswords(/set password/i, PASSWORD, PASSWORD);

    expect(await screen.findByText(INVALID_LINK)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/');
  });

  it('says the link is invalid when the URL carries no token', () => {
    setLocation('/auth/invite');

    render(<InvitePage />);

    expect(screen.getByText(INVALID_LINK)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});

describe('/auth/verify-email', () => {
  const confirmButton = () => screen.getByRole('button', { name: /confirm my email address/i });

  it('confirms an address only on click', async () => {
    setLocation('/auth/verify-email#token=v');
    verifyMock.mockResolvedValue(authOk(null, 204));
    render(<VerifyEmailPage />);

    // Opening the page is not consent: a link scanner does that too.
    expect(verifyMock).not.toHaveBeenCalled();

    await user.click(confirmButton());

    expect(verifyMock).toHaveBeenCalledWith('v');
    expect(
      await screen.findByText('Your email address is confirmed. You can sign in.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/');
  });

  it.each(['/auth/verify-email#token=v', '/auth/verify-email?token=v'])(
    'removes the token of %s from the address bar without using it',
    async (url) => {
      setLocation(url);
      verifyMock.mockResolvedValue(authOk(null, 204));
      render(<VerifyEmailPage />);

      expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/verify-email');
      expect(window.location.hash).toBe('');
      expect(window.location.search).toBe('');
      expect(verifyMock).not.toHaveBeenCalled();

      await user.click(confirmButton());
      expect(verifyMock).toHaveBeenCalledWith('v');
    },
  );

  it('offers a new link when the old one is dead', async () => {
    setLocation('/auth/verify-email#token=v');
    verifyMock.mockResolvedValue(authRefused(400, 'invalid_token'));
    resendMock.mockResolvedValue(authOk({ status: 'accepted' as const }, 202));
    render(<VerifyEmailPage />);

    await user.click(confirmButton());
    expect(await screen.findByText(INVALID_LINK)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm my email address/i })).toBeNull();

    await user.type(screen.getByLabelText(/email/i), 'a@example.test');
    await user.click(screen.getByRole('button', { name: /send a new link/i }));

    expect(resendMock).toHaveBeenCalledWith('a@example.test');
    expect(
      await screen.findByText("If this address needs confirming, we've sent a new link."),
    ).toBeInTheDocument();
  });

  it('offers a new link, without asking the API, when the URL carries no token', async () => {
    setLocation('/auth/verify-email');
    resendMock.mockResolvedValue(authOk({ status: 'accepted' as const }, 202));
    render(<VerifyEmailPage />);

    expect(screen.getByText(INVALID_LINK)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm my email address/i })).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/email/i), 'a@example.test');
    await user.click(screen.getByRole('button', { name: /send a new link/i }));

    expect(resendMock).toHaveBeenCalledWith('a@example.test');
  });

  it('tells a failed resend apart from a sent one', async () => {
    setLocation('/auth/verify-email');
    resendMock.mockResolvedValue(authRefused(429, 'too_many_attempts'));
    render(<VerifyEmailPage />);

    await user.type(screen.getByLabelText(/email/i), 'a@example.test');
    await user.click(screen.getByRole('button', { name: /send a new link/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    expect(screen.queryByText(/we've sent a new link/i)).not.toBeInTheDocument();
  });

  it('keeps the button for another try when the API cannot be reached', async () => {
    setLocation('/auth/verify-email#token=v');
    verifyMock.mockResolvedValueOnce(authRefused(0, null));
    verifyMock.mockResolvedValueOnce(authOk(null, 204));
    render(<VerifyEmailPage />);

    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach genolens/i);
    // The link is not dead: it is the network. Nothing to resend.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    await user.click(confirmButton());

    expect(verifyMock).toHaveBeenCalledTimes(2);
    expect(verifyMock).toHaveBeenLastCalledWith('v');
    expect(await screen.findByText(/your email address is confirmed/i)).toBeInTheDocument();
  });
});

describe('/auth/forgot', () => {
  const HEARD =
    "If an account exists for this address, we've sent a link to choose a new password. It is valid for one hour.";

  it('answers the same whatever the address', async () => {
    forgotMock.mockResolvedValue(authOk({ status: 'accepted' as const }, 202));
    render(<ForgotPage />);

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(forgotMock).toHaveBeenCalledWith('nobody@example.test');
    expect(await screen.findByText(/if an account exists for this address/i)).toBeInTheDocument();
    expect(screen.getByText(HEARD)).toBeInTheDocument();
    // The answer must not repeat the address: it would confirm nothing, but it
    // would not be the same sentence for everyone either.
    expect(screen.queryByText(/nobody@example\.test/)).not.toBeInTheDocument();
  });

  it('does not claim a link was sent when the request failed', async () => {
    forgotMock.mockResolvedValue(authRefused(0, null));
    render(<ForgotPage />);

    await user.type(screen.getByLabelText(/email/i), 'a@example.test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach genolens/i);
    expect(screen.queryByText(/if an account exists/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('leads back to the sign-in page', () => {
    render(<ForgotPage />);

    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/');
  });
});
