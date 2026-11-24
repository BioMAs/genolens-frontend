/**
 * The home page is the sign-in and sign-up screen: a password step, then a
 * code step (authenticator code or recovery code) on the same screen. The API
 * sets the session cookies; the page only decides where to go next, with a
 * full navigation (the root layout picks its shell on the server).
 *
 * `next/navigation`, the auth client and the navigation seam are simulated.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Home from '@/app/page';
import { hasSessionHint, login, resendVerification, signup, verifyMfa } from '@/utils/auth/client';
import { navigate } from '@/utils/auth/navigation';
import { authOk, authRefused } from '@/test-utils/authResults';

let query = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
jest.mock('@/utils/auth/client', () => ({
  hasSessionHint: jest.fn(),
  login: jest.fn(),
  verifyMfa: jest.fn(),
  signup: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

const hintMock = hasSessionHint as jest.MockedFunction<typeof hasSessionHint>;
const loginMock = login as jest.MockedFunction<typeof login>;
const verifyMfaMock = verifyMfa as jest.MockedFunction<typeof verifyMfa>;
const signupMock = signup as jest.MockedFunction<typeof signup>;
const resendMock = resendVerification as jest.MockedFunction<typeof resendVerification>;
const assign = navigate as jest.MockedFunction<typeof navigate>;

const search = (value: string) => {
  query = value;
};

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  jest.resetAllMocks();
  search('');
  user = userEvent.setup();
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = 'https://admin.example.test';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
});

const EMAIL = 'a@example.test';

async function fillAndSubmit(email: string, password: string) {
  await user.type(screen.getByTestId('auth-email'), email);
  await user.type(screen.getByTestId('auth-password'), password);
  await user.click(screen.getByTestId('auth-submit'));
}

async function submitCode(code: string) {
  await user.type(await screen.findByTestId('auth-code'), code);
  await user.click(screen.getByRole('button', { name: /verify/i }));
}

describe('sign in, password step', () => {
  it('keeps the identifiers the capture scripts rely on', () => {
    render(<Home />);

    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
    expect(screen.getByTestId('auth-email')).toHaveAttribute('id', 'email');
    expect(screen.getByTestId('auth-password')).toHaveAttribute('id', 'password');
    expect(screen.getByTestId('auth-submit')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sign in/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('sends the credentials as typed, without applying the sign-up length rule', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'short');

    expect(loginMock).toHaveBeenCalledWith(EMAIL, 'short');
    expect(await screen.findByTestId('auth-code')).toBeInTheDocument();
  });

  it('sends a first sign-in to the enrolment', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa_setup' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/2fa/setup?next=%2Fdashboard'));
    expect(screen.queryByTestId('auth-code')).not.toBeInTheDocument();
  });

  it('carries the destination through the enrolment', async () => {
    search('?next=%2Fprojects%2Fp1%3Ftab%3D2');
    loginMock.mockResolvedValue(authOk({ next: 'mfa_setup' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('/auth/2fa/setup?next=%2Fprojects%2Fp1%3Ftab%3D2'),
    );
  });

  it('keeps the submit button disabled while the sign-in is pending', async () => {
    loginMock.mockReturnValue(new Promise(() => {}));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    expect(screen.getByTestId('auth-submit')).toBeDisabled();
  });

  it('offers the reset link and the confirmation resend after a refusal', async () => {
    loginMock.mockResolvedValue(authRefused(401, 'invalid_credentials'));
    resendMock.mockResolvedValue(authOk({ status: 'accepted' as const }, 202));
    render(<Home />);

    expect(
      screen.queryByRole('button', { name: /resend the confirmation email/i }),
    ).not.toBeInTheDocument();

    await fillAndSubmit(EMAIL, 'wrong-password-x');

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Incorrect email or password.',
    );
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/auth/forgot',
    );

    await user.click(screen.getByRole('button', { name: /signed up recently\?/i }));

    expect(resendMock).toHaveBeenCalledWith(EMAIL);
    expect(await screen.findByRole('status')).toHaveTextContent(
      "If this address needs confirming, we've sent a new link.",
    );
    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /resend the confirmation email/i }),
    ).not.toBeInTheDocument();
  });

  it('says why a resend failed', async () => {
    loginMock.mockResolvedValue(authRefused(401, 'invalid_credentials'));
    resendMock.mockResolvedValue(authRefused(429, 'too_many_attempts'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'wrong-password-x');
    await user.click(await screen.findByRole('button', { name: /resend the confirmation email/i }));

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Too many attempts. Wait 15 minutes, or reset your password.',
    );
  });

  it('does not offer the resend for another refusal', async () => {
    loginMock.mockResolvedValue(authRefused(429, 'too_many_attempts'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Too many attempts. Wait 15 minutes, or reset your password.',
    );
    expect(
      screen.queryByRole('button', { name: /resend the confirmation email/i }),
    ).not.toBeInTheDocument();
  });

  it('says when the API cannot be reached', async () => {
    loginMock.mockResolvedValue(authRefused(0, null));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Cannot reach GenoLens. Check your connection and try again.',
    );
    expect(screen.getByTestId('auth-submit')).toBeEnabled();
  });
});

describe('sign in, code step', () => {
  it('asks for the code after the password, then goes to next', async () => {
    search('?next=%2Fprojects%2Fp1');
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authOk({ next: 'app' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'correct horse battery');
    await user.type(await screen.findByTestId('auth-code'), '123 456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(verifyMfaMock).toHaveBeenCalledWith({ code: '123 456' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/projects/p1'));
  });

  it('never follows an unsafe destination', async () => {
    search('?next=%2F%2Fevil.test');
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authOk({ next: 'app' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('123456');

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'));
  });

  it('accepts the admin app as a destination', async () => {
    search(`?next=${encodeURIComponent('https://admin.example.test/users')}`);
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authOk({ next: 'app' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('123456');

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://admin.example.test/users'));
  });

  it('asks for a numeric one-time code, and says what it is for', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');

    const field = await screen.findByTestId('auth-code');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByLabelText(/authentication code/i)).toBe(field);
    expect(field).toHaveAccessibleDescription(/6-digit code from your authenticator app/i);
  });

  it('counts down wrong codes, then restarts the sign-in', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock
      .mockResolvedValueOnce(authRefused(401, 'invalid_code', { attempts_left: 2 }))
      .mockResolvedValueOnce(authRefused(401, 'invalid_code', { attempts_left: 0 }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code. 2 attempts left.');

    await submitCode('000000');
    expect(await screen.findByTestId('auth-password')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sign-in step has expired. Sign in again.',
    );
    expect(screen.queryByTestId('auth-code')).not.toBeInTheDocument();
    // The address is kept, the password must be typed again.
    expect(screen.getByTestId('auth-email')).toHaveValue(EMAIL);
    expect(screen.getByTestId('auth-password')).toHaveValue('');
  });

  it('speaks of a single attempt in the singular', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(401, 'invalid_code', { attempts_left: 1 }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code. 1 attempt left.');
  });

  it('empties the field after a wrong code', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(401, 'invalid_code', { attempts_left: 2 }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('000000');
    await screen.findByRole('alert');

    expect(screen.getByTestId('auth-code')).toHaveValue('');
  });

  it('falls back to the plain message when the API sends no count', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(401, 'invalid_code'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Incorrect code\.$/);
  });

  it('restarts the sign-in when the step has expired', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(401, 'challenge_expired'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('123456');

    expect(await screen.findByTestId('auth-password')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sign-in step has expired. Sign in again.',
    );
  });

  it('stays on the code step when the attempts are rate limited', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(429, 'too_many_attempts'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Wait 15 minutes, or reset your password.',
    );
    expect(screen.getByTestId('auth-code')).toBeInTheDocument();
  });

  it('accepts a recovery code', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authOk({ next: 'app' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await user.click(await screen.findByRole('button', { name: /use a recovery code/i }));
    await submitCode('abcde-fghij');

    expect(verifyMfaMock).toHaveBeenCalledWith({ recovery_code: 'abcde-fghij' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'));
  });

  it('switches between the two kinds of code and empties the field', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await user.type(await screen.findByTestId('auth-code'), '123456');
    await user.click(screen.getByRole('button', { name: /use a recovery code/i }));

    const recoveryField = screen.getByTestId('auth-code');
    expect(recoveryField).toHaveValue('');
    expect(recoveryField).toHaveAttribute('inputmode', 'text');
    expect(recoveryField).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/recovery code/i)).toBe(recoveryField);
    expect(screen.queryByRole('button', { name: /use a recovery code/i })).not.toBeInTheDocument();

    await user.type(recoveryField, 'abcde');
    await user.click(screen.getByRole('button', { name: /authenticator code/i }));

    expect(screen.getByTestId('auth-code')).toHaveValue('');
    expect(screen.getByTestId('auth-code')).toHaveAttribute('inputmode', 'numeric');
  });

  it('drops the error of the other kind of code when switching', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    verifyMfaMock.mockResolvedValue(authRefused(401, 'invalid_code', { attempts_left: 2 }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await submitCode('000000');
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /use a recovery code/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens on the code step when asked', () => {
    search('?step=mfa');
    render(<Home />);

    expect(screen.getByTestId('auth-code')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-password')).not.toBeInTheDocument();
  });

  it('does not keep the password once the code is asked, and keeps the address on the way back', async () => {
    loginMock.mockResolvedValue(authOk({ next: 'mfa' as const }));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'pw-long-enough');
    await user.click(await screen.findByRole('button', { name: /back to sign in/i }));

    expect(screen.getByTestId('auth-email')).toHaveValue(EMAIL);
    expect(screen.getByTestId('auth-password')).toHaveValue('');
  });

  it('lets the visitor go back to the password step', async () => {
    search('?step=mfa');
    render(<Home />);

    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(screen.getByTestId('auth-password')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('sign up', () => {
  it('checks the password length before signing up', async () => {
    render(<Home />);

    await user.click(screen.getByRole('tab', { name: /sign up/i }));
    await fillAndSubmit(EMAIL, 'short');

    expect(signupMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Use at least 12 characters.');
  });

  it('asks the visitor to check their inbox', async () => {
    signupMock.mockResolvedValue(authOk({ status: 'accepted' as const }, 202));
    render(<Home />);

    await user.click(screen.getByRole('tab', { name: /sign up/i }));
    await fillAndSubmit(EMAIL, 'a long enough password');

    expect(signupMock).toHaveBeenCalledWith(EMAIL, 'a long enough password');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Check your inbox — we sent a link to confirm your account.',
    );
    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument();
  });

  it.each([
    [400, 'password_policy:too_common', 'This password is too common. Choose a less predictable one.'],
    [404, null, 'This is not available yet.'],
    [0, null, 'Cannot reach GenoLens. Check your connection and try again.'],
  ])('shows the refusal %i %s', async (status, detail, message) => {
    signupMock.mockResolvedValue(authRefused(status, detail));
    render(<Home />);

    await user.click(screen.getByRole('tab', { name: /sign up/i }));
    await fillAndSubmit(EMAIL, 'a long enough password');

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(message);
  });

  it('has no forgot-password link nor resend offer', async () => {
    render(<Home />);

    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    expect(screen.queryByRole('link', { name: /forgot password/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('clears messages when switching tabs', async () => {
    loginMock.mockResolvedValue(authRefused(401, 'invalid_credentials'));
    render(<Home />);

    await fillAndSubmit(EMAIL, 'wrong-password-x');
    await screen.findByTestId('auth-error');
    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /sign in/i }));

    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /resend the confirmation email/i }),
    ).not.toBeInTheDocument();
  });
});

// A renewal that failed for a transient reason (the API answered 5xx or 429, or could
// not be reached) lands here as `reauth=1` while the session is in fact still valid.
// The form alone would strand the visitor, even after a reload: offer to try again.
describe('a renewal that failed', () => {
  const NOTICE = /we couldn't restore your session/i;

  it('offers to try again when the session hint survives', () => {
    search('?next=%2Fprojects%2Fp1%3Ftab%3D2&reauth=1');
    hintMock.mockReturnValue(true);
    render(<Home />);

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/auth/refresh?next=%2Fprojects%2Fp1%3Ftab%3D2',
    );
    // The form stays, so the visitor can also sign in.
    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
  });

  it('retries towards the admin app when that is where the visitor was going', () => {
    search('?next=https%3A%2F%2Fadmin.example.test%2Fusers&reauth=1');
    hintMock.mockReturnValue(true);
    render(<Home />);

    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/auth/refresh?next=https%3A%2F%2Fadmin.example.test%2Fusers',
    );
  });

  it('retries towards the dashboard when next is not a safe destination', () => {
    search('?next=https%3A%2F%2Fevil.test&reauth=1');
    hintMock.mockReturnValue(true);
    render(<Home />);

    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/auth/refresh?next=%2Fdashboard',
    );
  });

  it('says nothing when there is no session left to restore', () => {
    search('?next=%2Fprojects&reauth=1');
    hintMock.mockReturnValue(false);
    render(<Home />);

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('says nothing on an ordinary visit, whatever the hint', () => {
    search('?next=%2Fprojects');
    hintMock.mockReturnValue(true);
    render(<Home />);

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  // A sign-out the API could not take also lands on `/?reauth=1`, but with no next:
  // offering to restore the session the visitor just asked to end would be wrong.
  it('says nothing after a sign-out that could not reach the API (no next)', () => {
    search('?reauth=1');
    hintMock.mockReturnValue(true);
    render(<Home />);

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
