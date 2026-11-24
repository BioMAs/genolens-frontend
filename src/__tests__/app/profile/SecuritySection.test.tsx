/**
 * `SecuritySection` is the account security part of `/profile`: password,
 * two-factor status, recovery codes, change of phone and the signed-in devices.
 *
 * Every call goes through the shared axios instance (`@/utils/api`), simulated
 * here, and the session routes refuse with a 400 (never a 401) for a wrong
 * password or code, so a refusal arrives as an axios error carrying
 * `response.data.detail`. `signOut` and `qrcode` are simulated too.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import QRCode from 'qrcode';

import SecuritySection from '@/app/profile/SecuritySection';
import api from '@/utils/api';
import { signOut } from '@/utils/auth/client';
import type { AuthSessionInfo, UserProfile } from '@/types';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/utils/auth/client', () => ({ signOut: jest.fn() }));
jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL: jest.fn() } }));

const mockedApi = api as jest.Mocked<typeof api>;
const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const toDataURL = QRCode.toDataURL as unknown as jest.Mock;

const SECRET = {
  otpauth_uri: 'otpauth://totp/GenoLens:ada@example.test?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSWY3DPEHPK3PXP',
};
const TEN_CODES = Array.from({ length: 10 }, (_, i) => `ABCD${i}-EFGH${i}`);

const THIS_DEVICE: AuthSessionInfo = {
  id: 's1',
  created_at: '2026-11-20T08:00:00Z',
  last_used_at: '2026-11-24T09:30:00Z',
  ip: '203.0.113.7',
  user_agent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  current: true,
};
const OTHER_DEVICE: AuthSessionInfo = {
  id: 's2',
  created_at: '2026-11-18T08:00:00Z',
  last_used_at: '2026-11-22T17:05:00Z',
  ip: '198.51.100.4',
  user_agent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  current: false,
};

const PROFILE: UserProfile = {
  id: 'u1',
  email: 'ada@example.test',
  role: 'USER',
  subscription_plan: 'TEAM',
  ai_interpretations_used: 0,
  ai_tokens_purchased: 0,
  ai_tokens_used: 0,
  mfa_enabled: true,
  recovery_codes_remaining: 8,
};

/** What the API answers to the two reads the section makes. */
function serve(opts: { profile?: Partial<UserProfile>; sessions?: AuthSessionInfo[] } = {}) {
  const sessions = opts.sessions ?? [THIS_DEVICE, OTHER_DEVICE];
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url === '/users/me') return { data: { ...PROFILE, ...opts.profile } };
    if (url === '/auth/sessions') return { data: sessions };
    throw new Error(`unexpected GET ${url}`);
  });
}

/** The refusal an axios call rejects with. */
function axiosError(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { detail, ...extra } },
  });
}

const callsTo = (url: string) => mockedApi.get.mock.calls.filter(([u]) => u === url).length;

let user: ReturnType<typeof userEvent.setup>;
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderSection() {
  return render(<SecuritySection />, { wrapper });
}

const block = (name: string) => screen.findByRole('region', { name });

beforeEach(() => {
  jest.resetAllMocks();
  user = userEvent.setup();
  // One client per test: nothing cached leaks from a test to the next.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  serve();
  toDataURL.mockResolvedValue('data:image/png;base64,QRPIXELS');
});

async function changePassword(current: string, next: string, confirm = next) {
  renderSection();
  const password = within(await block('Password'));
  await user.type(password.getByLabelText('Current password'), current);
  await user.type(password.getByLabelText('New password'), next);
  await user.type(password.getByLabelText('Confirm new password'), confirm);
  await user.click(password.getByRole('button', { name: 'Change password' }));
}

async function regenerate(code: string) {
  renderSection();
  const codes = within(await block('Recovery codes'));
  await user.type(codes.getByLabelText('Authentication code'), code);
  await user.click(codes.getByRole('button', { name: 'Generate new codes' }));
}

async function startRotation(password: string, code: string) {
  renderSection();
  const phone = within(await block('Change phone'));
  await user.type(phone.getByLabelText('Password'), password);
  await user.type(phone.getByLabelText('Authentication code'), code);
  await user.click(phone.getByRole('button', { name: 'Continue' }));
}

async function submitCode(code: string) {
  const phone = within(await block('Change phone'));
  await user.type(await phone.findByLabelText('Authentication code'), code);
  await user.click(phone.getByRole('button', { name: 'Verify' }));
}

describe('two-factor authentication', () => {
  it('says it is on', async () => {
    renderSection();

    const status = within(await block('Two-factor authentication'));
    expect(await status.findByText('On')).toBeInTheDocument();
  });

  it('warns when few recovery codes are left', async () => {
    serve({ profile: { mfa_enabled: true, recovery_codes_remaining: 2 } });

    renderSection();

    expect(
      await screen.findByText('Only 2 recovery codes left. Generate new ones.'),
    ).toBeInTheDocument();
  });

  it.each([
    [1, 'Only 1 recovery code left. Generate new ones.'],
    [0, 'Only 0 recovery codes left. Generate new ones.'],
  ])('words the warning for %i code(s) left', async (remaining, warning) => {
    serve({ profile: { recovery_codes_remaining: remaining } });

    renderSection();

    expect(await screen.findByText(warning)).toBeInTheDocument();
  });

  it('stays quiet while there are enough recovery codes', async () => {
    renderSection();

    await screen.findByText('On');
    expect(screen.queryByText(/recovery codes? left/i)).not.toBeInTheDocument();
  });
});

describe('changing the password', () => {
  it('changes it, empties the fields and says the other sessions were signed out', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: null, status: 204 });

    await changePassword('current-password-1', 'a-long-new-password');

    expect(await screen.findByText('Password changed. Your other sessions were signed out.')).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/password/change', {
      current_password: 'current-password-1',
      new_password: 'a-long-new-password',
    });
    const password = within(screen.getByRole('region', { name: 'Password' }));
    expect(password.getByLabelText('Current password')).toHaveValue('');
    expect(password.getByLabelText('New password')).toHaveValue('');
    expect(password.getByLabelText('Confirm new password')).toHaveValue('');
  });

  it('reads the sessions again, the other ones being gone', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: null, status: 204 });
    await changePassword('current-password-1', 'a-long-new-password');
    await screen.findByText('Password changed. Your other sessions were signed out.');

    await waitFor(() => expect(callsTo('/auth/sessions')).toBe(2));
  });

  it('maps a wrong current password', async () => {
    mockedApi.post.mockRejectedValueOnce(axiosError(400, 'invalid_password'));

    await changePassword('wrong-current-pw', 'a-long-new-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is incorrect.');
  });

  it('maps a refusal of the policy and keeps what was typed to correct it', async () => {
    mockedApi.post.mockRejectedValueOnce(axiosError(400, 'password_policy:too_common'));

    await changePassword('current-password-1', 'password1234');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This password is too common. Choose a less predictable one.',
    );
    expect(screen.queryByText(/password changed/i)).not.toBeInTheDocument();
    const password = within(screen.getByRole('region', { name: 'Password' }));
    expect(password.getByLabelText('New password')).toHaveValue('password1234');
  });

  it('says so when the attempts are used up', async () => {
    mockedApi.post.mockRejectedValueOnce(axiosError(429, 'too_many_attempts'));

    await changePassword('current-password-1', 'a-long-new-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
  });

  it('does not send a new password that is too short', async () => {
    await changePassword('current-password-1', 'short');

    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 12 characters.');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('does not send two passwords that differ', async () => {
    await changePassword('current-password-1', 'a-long-new-password', 'a-long-new-passwore');

    expect(await screen.findByRole('alert')).toHaveTextContent('Both passwords must match.');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});

describe('recovery codes', () => {
  it('shows new recovery codes after a regeneration', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { recovery_codes: TEN_CODES } });

    await regenerate('123456');

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/mfa/recovery-codes/regenerate', {
      code: '123456',
    });
    expect(
      within(await screen.findByTestId('recovery-codes')).getAllByRole('listitem'),
    ).toHaveLength(10);
  });

  it('only lets the codes go once they are acknowledged, and then shows the form again', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { recovery_codes: TEN_CODES } });
    await regenerate('123456');

    const codes = within(await block('Recovery codes'));
    const done = await codes.findByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();

    await user.click(screen.getByTestId('recovery-ack'));
    await user.click(done);

    expect(screen.queryByTestId('recovery-codes')).not.toBeInTheDocument();
    expect(codes.getByLabelText('Authentication code')).toHaveValue('');
  });

  it('reads the profile again: the count of codes left has changed', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { recovery_codes: TEN_CODES } });

    await regenerate('123456');
    await screen.findByTestId('recovery-codes');

    await waitFor(() => expect(callsTo('/users/me')).toBe(2));
  });

  it('refuses a wrong code and shows no codes', async () => {
    mockedApi.post.mockRejectedValueOnce(axiosError(400, 'invalid_code'));

    await regenerate('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code.');
    expect(screen.queryByTestId('recovery-codes')).not.toBeInTheDocument();
  });
});

describe('changing the phone', () => {
  it('asks for the password and a code, then shows the new key to enrol', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: SECRET });

    await startRotation('my-password-123', '123456');

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/mfa/rotate/start', {
      password: 'my-password-123',
      code: '123456',
    });
    expect(await screen.findByTestId('totp-secret')).toHaveAttribute('data-secret', SECRET.secret);
  });

  it('ends with the new recovery codes, then goes back to the start', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockResolvedValueOnce({ data: { recovery_codes: TEN_CODES } });
    await startRotation('my-password-123', '123456');

    await submitCode('654321');

    expect(mockedApi.post).toHaveBeenLastCalledWith('/auth/mfa/rotate/confirm', { code: '654321' });
    expect(
      within(await screen.findByTestId('recovery-codes')).getAllByRole('listitem'),
    ).toHaveLength(10);

    await user.click(screen.getByTestId('recovery-ack'));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const phone = within(screen.getByRole('region', { name: 'Change phone' }));
    expect(phone.getByLabelText('Password')).toHaveValue('');
    expect(phone.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('reads the profile again once the phone has changed: the codes are new', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockResolvedValueOnce({ data: { recovery_codes: TEN_CODES } });
    await startRotation('my-password-123', '123456');
    await submitCode('654321');
    await screen.findByTestId('recovery-codes');

    await waitFor(() => expect(callsTo('/users/me')).toBeGreaterThanOrEqual(2));
  });

  it.each([
    ['a wrong password', 'invalid_password', 'Your current password is incorrect.'],
    ['a wrong code', 'invalid_code', 'Incorrect code.'],
  ])('stays on the first step after %s', async (_label, detail, message) => {
    mockedApi.post.mockRejectedValueOnce(axiosError(400, detail));

    await startRotation('my-password-123', '123456');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('restarts a phone change after a wrong confirmation code', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockRejectedValueOnce(axiosError(400, 'invalid_code'));

    await startRotation('my-password-123', '123456');
    await submitCode('000000');

    // The API threw the pending key away: only a new start will do.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This change of device has expired. Start again.',
    );
    const phone = within(screen.getByRole('region', { name: 'Change phone' }));
    expect(phone.getByLabelText('Password')).toHaveValue('');
    expect(phone.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('restarts when the API has no change pending any more', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockRejectedValueOnce(axiosError(400, 'no_rotation_pending'));

    await startRotation('my-password-123', '123456');
    await submitCode('654321');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This change of device has expired. Start again.',
    );
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('keeps the new key on screen when the confirmation is only rate limited', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockRejectedValueOnce(axiosError(429, 'too_many_attempts'));

    await startRotation('my-password-123', '123456');
    await submitCode('654321');

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
    expect(screen.getByTestId('totp-secret')).toBeInTheDocument();
  });

  it('lets go of a change in progress', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: SECRET });
    await startRotation('my-password-123', '123456');
    await screen.findByTestId('totp-secret');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const phone = within(screen.getByRole('region', { name: 'Change phone' }));
    expect(phone.getByLabelText('Password')).toHaveValue('');
    expect(phone.queryByTestId('totp-secret')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can start again from a fresh form once restarted', async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: SECRET })
      .mockRejectedValueOnce(axiosError(400, 'invalid_code'))
      .mockResolvedValueOnce({ data: { ...SECRET, secret: 'KRSXG5CTMVRXEZLU' } });
    await startRotation('my-password-123', '123456');
    await submitCode('000000');
    await screen.findByRole('alert');

    const phone = within(screen.getByRole('region', { name: 'Change phone' }));
    await user.type(phone.getByLabelText('Password'), 'my-password-123');
    await user.type(phone.getByLabelText('Authentication code'), '123456');
    await user.click(phone.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByTestId('totp-secret')).toHaveAttribute(
      'data-secret',
      'KRSXG5CTMVRXEZLU',
    );
  });
});

describe('sessions', () => {
  it('lists the devices with their address and last activity, this one first', async () => {
    serve({ sessions: [OTHER_DEVICE, THIS_DEVICE] });

    renderSection();

    const sessions = within(await block('Sessions'));
    const rows = await sessions.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Chrome on macOS');
    expect(rows[0]).toHaveTextContent('This device');
    expect(rows[0]).toHaveTextContent('203.0.113.7');
    expect(rows[1]).toHaveTextContent('Safari on iPhone');
    expect(rows[1]).toHaveTextContent('198.51.100.4');
    expect(rows[1]).not.toHaveTextContent('This device');
    // The date itself follows the viewer's locale and zone: only what it stands for is pinned.
    const lastActivity = rows[1].querySelector('time');
    expect(lastActivity).toHaveAttribute('datetime', '2026-11-22T17:05:00Z');
    expect(lastActivity?.textContent).toMatch(/2026/);
  });

  it('copes with a session whose device and address are unknown', async () => {
    serve({ sessions: [{ ...THIS_DEVICE, ip: null, user_agent: null }] });

    renderSection();

    const sessions = within(await block('Sessions'));
    expect(await sessions.findByText('Unknown device')).toBeInTheDocument();
  });

  it('revokes another session but signs out of this one', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: null, status: 204 });
    renderSection();

    await user.click(await screen.findByRole('button', { name: /revoke/i }));
    expect(mockedApi.delete).toHaveBeenCalledWith('/auth/sessions/s2');

    await user.click(screen.getByRole('button', { name: /^sign out$/i }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    // Signing out of this device is `signOut`'s job: no DELETE of the current session.
    expect(mockedApi.delete).toHaveBeenCalledTimes(1);
  });

  it('reads the sessions again after a revocation', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: null, status: 204 });
    renderSection();

    await user.click(await screen.findByRole('button', { name: /revoke/i }));

    await waitFor(() => expect(callsTo('/auth/sessions')).toBe(2));
  });

  it('refreshes quietly when the session to revoke was already gone', async () => {
    mockedApi.delete.mockRejectedValueOnce(axiosError(404, 'session_not_found'));
    renderSection();

    await user.click(await screen.findByRole('button', { name: /revoke/i }));

    await waitFor(() => expect(callsTo('/auth/sessions')).toBe(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when a revocation fails', async () => {
    mockedApi.delete.mockRejectedValueOnce(axiosError(500, 'oops'));
    renderSection();

    await user.click(await screen.findByRole('button', { name: /revoke/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
  });

  it('signs out every other session', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { revoked: 2 } });
    renderSection();

    await user.click(await screen.findByRole('button', { name: /sign out of all other sessions/i }));

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/sessions/revoke-all');
    expect(await screen.findByText('2 other sessions signed out.')).toBeInTheDocument();
  });

  it('says it in the singular for one session', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { revoked: 1 } });
    renderSection();

    await user.click(await screen.findByRole('button', { name: /sign out of all other sessions/i }));

    expect(await screen.findByText('1 other session signed out.')).toBeInTheDocument();
  });

  it('has nothing to sign out when this device is the only one', async () => {
    serve({ sessions: [THIS_DEVICE] });
    renderSection();

    await screen.findByText('This device');

    expect(screen.getByRole('button', { name: /sign out of all other sessions/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });

  it('says so when the sessions cannot be read', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/users/me') return { data: PROFILE };
      throw axiosError(500, 'oops');
    });

    renderSection();

    const sessions = within(await block('Sessions'));
    expect(await sessions.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
  });
});
