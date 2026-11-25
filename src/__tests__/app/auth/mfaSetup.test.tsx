/**
 * `/auth/2fa/setup` is where a first sign-in lands (`next: "mfa_setup"`): the
 * visitor scans a QR code, proves the app works with a first code, and is shown
 * the recovery codes once. The session opens on that confirmation, so the page
 * only leaves after the codes are acknowledged, with a full navigation.
 *
 * `next/navigation`, the auth client, the navigation seam and `qrcode` are
 * simulated.
 */
import { StrictMode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCode from 'qrcode';

import MfaSetupPage from '@/app/auth/2fa/setup/page';
import { confirmMfaSetup, startMfaSetup } from '@/utils/auth/client';
import { navigate, reloadPage } from '@/utils/auth/navigation';
import { authOk, authRefused } from '@/test-utils/authResults';

let query = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
jest.mock('@/utils/auth/client', () => ({
  startMfaSetup: jest.fn(),
  confirmMfaSetup: jest.fn(),
}));
jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn(), reloadPage: jest.fn() }));
jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL: jest.fn() } }));

const startMock = startMfaSetup as jest.MockedFunction<typeof startMfaSetup>;
const confirmMock = confirmMfaSetup as jest.MockedFunction<typeof confirmMfaSetup>;
const assign = navigate as jest.MockedFunction<typeof navigate>;
const reload = reloadPage as jest.MockedFunction<typeof reloadPage>;
const toDataURL = QRCode.toDataURL as unknown as jest.Mock;

const search = (value: string) => {
  query = value;
};

const SECRET = {
  otpauth_uri: 'otpauth://totp/GenoLens:a@example.test?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSWY3DPEHPK3PXP',
};
const TEN_CODES = Array.from(
  { length: 10 },
  (_, i) => `ABCD${i}-EFGH${i}`,
);

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  jest.resetAllMocks();
  search('');
  user = userEvent.setup();
  toDataURL.mockResolvedValue('data:image/png;base64,QRPIXELS');
  process.env.NEXT_PUBLIC_ADMIN_APP_URL = 'https://admin.example.test';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_APP_URL;
});

async function submitCode(code: string) {
  await user.type(await screen.findByLabelText(/authentication code/i), code);
  await user.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('starting the enrolment', () => {
  it('starts the enrolment once, even under StrictMode', async () => {
    startMock.mockResolvedValue(authOk(SECRET));

    render(
      <StrictMode>
        <MfaSetupPage />
      </StrictMode>,
    );

    expect(await screen.findByTestId('totp-secret')).toHaveTextContent('JBSW Y3DP EHPK 3PXP');
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('says it is preparing while the secret is on its way', () => {
    startMock.mockReturnValue(new Promise(() => {}));

    render(<MfaSetupPage />);

    expect(screen.getByRole('status')).toHaveTextContent(/preparing/i);
  });

  it('draws the QR code in the browser, from the secret the API issued', async () => {
    startMock.mockResolvedValue(authOk(SECRET));

    render(<MfaSetupPage />);

    const qr = await screen.findByRole('img', { name: /qr code/i });
    expect(toDataURL).toHaveBeenCalledWith(SECRET.otpauth_uri, expect.anything());
    expect(qr).toHaveAttribute('src', 'data:image/png;base64,QRPIXELS');
  });

  it('sends an expired step back to the sign-in', async () => {
    startMock.mockResolvedValue(authRefused(401, 'challenge_expired'));

    render(<MfaSetupPage />);

    expect(await screen.findByRole('link', { name: /sign in again/i })).toHaveAttribute(
      'href',
      '/?next=%2Fdashboard',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This sign-in step has expired.');
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('keeps the destination across the sign-in again, but only a safe one', async () => {
    startMock.mockResolvedValue(authRefused(401, 'challenge_expired'));
    search('?next=%2Fprojects');
    const { unmount } = render(<MfaSetupPage />);
    expect(await screen.findByRole('link', { name: /sign in again/i })).toHaveAttribute(
      'href',
      '/?next=%2Fprojects',
    );
    unmount();

    search('?next=%2F%2Fevil.test');
    render(<MfaSetupPage />);
    expect(await screen.findByRole('link', { name: /sign in again/i })).toHaveAttribute(
      'href',
      '/?next=%2Fdashboard',
    );
  });

  it('explains any other refusal, and still offers the sign-in', async () => {
    startMock.mockResolvedValue(authRefused(404, null));

    render(<MfaSetupPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('This is not available yet.');
    expect(screen.getByRole('link', { name: /sign in again/i })).toBeInTheDocument();
  });
});

describe('confirming the first code', () => {
  it('shows the codes once confirmed, and leaves only after they are saved', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authOk({ recovery_codes: TEN_CODES }));
    search('?next=%2Fprojects');
    render(<MfaSetupPage />);

    await submitCode('123456');

    expect(confirmMock).toHaveBeenCalledWith('123456');
    expect(within(await screen.findByTestId('recovery-codes')).getAllByRole('listitem')).toHaveLength(
      10,
    );
    const done = screen.getByRole('button', { name: 'Continue to GenoLens' });
    expect(done).toBeDisabled();
    expect(assign).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('recovery-ack'));
    await user.click(done);

    expect(assign).toHaveBeenCalledWith('/projects');
  });

  it('falls back to the dashboard when the destination is not safe', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authOk({ recovery_codes: TEN_CODES }));
    search('?next=https%3A%2F%2Fevil.test');
    render(<MfaSetupPage />);

    await submitCode('123456');
    await user.click(await screen.findByTestId('recovery-ack'));
    await user.click(screen.getByRole('button', { name: 'Continue to GenoLens' }));

    expect(assign).toHaveBeenCalledWith('/dashboard');
  });

  it('reports a wrong code with the attempts left, and empties the field', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authRefused(401, 'invalid_code', { attempts_left: 4 }));
    render(<MfaSetupPage />);

    await submitCode('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code. 4 attempts left.');
    expect(screen.getByLabelText(/authentication code/i)).toHaveValue('');
    expect(screen.getByTestId('totp-secret')).toBeInTheDocument();
  });

  it('lets the visitor try again after a wrong code', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock
      .mockResolvedValueOnce(authRefused(401, 'invalid_code', { attempts_left: 4 }))
      .mockResolvedValueOnce(authOk({ recovery_codes: TEN_CODES }));
    render(<MfaSetupPage />);

    await submitCode('000000');
    await screen.findByRole('alert');
    await submitCode('123456');

    expect(await screen.findByTestId('recovery-codes')).toBeInTheDocument();
    expect(confirmMock).toHaveBeenNthCalledWith(2, '123456');
  });

  it('does not send the code twice while the first answer is awaited', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockReturnValue(new Promise(() => {}));
    render(<MfaSetupPage />);

    await submitCode('123456');

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it('sends an expired step back to the sign-in', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authRefused(401, 'challenge_expired'));
    render(<MfaSetupPage />);

    await submitCode('123456');

    expect(await screen.findByRole('link', { name: /sign in again/i })).toBeInTheDocument();
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('sends the visitor back to the sign-in when the attempts are used up', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authRefused(401, 'invalid_code', { attempts_left: 0 }));
    render(<MfaSetupPage />);

    await submitCode('000000');

    expect(await screen.findByRole('link', { name: /sign in again/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This sign-in step has expired.');
  });

  it('says so when the API cannot be reached, and keeps the enrolment', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authRefused(0, null));
    render(<MfaSetupPage />);

    await submitCode('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach GenoLens.');
    expect(screen.getByTestId('totp-secret')).toBeInTheDocument();
  });
});

// A browser may keep the page it leaves in its back/forward cache and show it again on
// "Back", secret included: the key and the codes are dropped on the way out, and a page
// that comes back from that cache is reloaded.
describe('leaving the page', () => {
  const pageTransition = (type: 'pagehide' | 'pageshow', persisted: boolean) =>
    act(() => {
      window.dispatchEvent(new PageTransitionEvent(type, { persisted }));
    });

  it('drops the key as the page is left', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    render(<MfaSetupPage />);
    await screen.findByTestId('totp-secret');

    pageTransition('pagehide', true);

    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
    expect(screen.queryByText(/JBSW Y3DP/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /qr code/i })).not.toBeInTheDocument();
  });

  it('drops the recovery codes as the page is left', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    confirmMock.mockResolvedValue(authOk({ recovery_codes: TEN_CODES }));
    render(<MfaSetupPage />);
    await submitCode('123456');
    await screen.findByTestId('recovery-codes');

    pageTransition('pagehide', true);

    expect(screen.queryByTestId('recovery-codes')).not.toBeInTheDocument();
    expect(screen.queryByText(TEN_CODES[0])).not.toBeInTheDocument();
  });

  it('reloads when the page comes back from the back/forward cache', async () => {
    startMock.mockResolvedValue(authOk(SECRET));
    render(<MfaSetupPage />);
    await screen.findByTestId('totp-secret');

    pageTransition('pagehide', true);
    pageTransition('pageshow', true);

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
