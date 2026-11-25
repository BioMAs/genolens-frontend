import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCode from 'qrcode';

import TotpEnrollment from '@/components/auth/TotpEnrollment';

jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL: jest.fn() } }));

const toDataURL = QRCode.toDataURL as unknown as jest.Mock;

const SECRET = {
  otpauth_uri: 'otpauth://totp/GenoLens:a@example.test?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSWY3DPEHPK3PXP',
};

let user: ReturnType<typeof userEvent.setup>;

const renderEnrollment = (props: Partial<React.ComponentProps<typeof TotpEnrollment>> = {}) =>
  render(
    <TotpEnrollment secret={SECRET} busy={false} error={null} onSubmit={jest.fn()} {...props} />,
  );

beforeEach(() => {
  jest.resetAllMocks();
  user = userEvent.setup();
  toDataURL.mockResolvedValue('data:image/png;base64,QRPIXELS');
});

it('shows the key to type by hand, in groups of four', () => {
  renderEnrollment();

  const key = screen.getByTestId('totp-secret');
  expect(key).toHaveTextContent('JBSW Y3DP EHPK 3PXP');
});

it('keeps the key in the visible text only, not in an attribute', () => {
  renderEnrollment();

  const key = screen.getByTestId('totp-secret');
  for (const { value } of Array.from(key.attributes)) {
    expect(value).not.toContain(SECRET.secret);
  }
});

it('draws the QR code from the otpauth URI, with a text alternative', async () => {
  renderEnrollment();

  const qr = await screen.findByRole('img', { name: /qr code/i });
  expect(qr).toHaveAttribute('src', 'data:image/png;base64,QRPIXELS');
  expect(toDataURL).toHaveBeenCalledWith(SECRET.otpauth_uri, expect.anything());
  // The alternative text must not leak the secret to whatever reads it.
  expect(qr.getAttribute('alt')).not.toContain(SECRET.secret);
});

it('redraws the QR code when the secret changes', async () => {
  const { rerender } = renderEnrollment();
  await screen.findByRole('img', { name: /qr code/i });
  toDataURL.mockResolvedValue('data:image/png;base64,SECOND');

  rerender(
    <TotpEnrollment
      secret={{ otpauth_uri: 'otpauth://totp/GenoLens:b@example.test?secret=KRSXG5CTMVRXEZLU', secret: 'KRSXG5CTMVRXEZLU' }}
      busy={false}
      error={null}
      onSubmit={jest.fn()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByRole('img', { name: /qr code/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,SECOND',
    ),
  );
});

it('falls back on the key when the QR code cannot be drawn', async () => {
  toDataURL.mockRejectedValue(new Error('canvas unavailable'));
  renderEnrollment();

  expect(await screen.findByText(/could not draw the qr code/i)).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByTestId('totp-secret')).toBeInTheDocument();
});

it('hands the typed code to its parent', async () => {
  const onSubmit = jest.fn();
  renderEnrollment({ onSubmit });

  await user.type(screen.getByLabelText(/authentication code/i), '123456');
  await user.click(screen.getByRole('button', { name: 'Verify' }));

  expect(onSubmit).toHaveBeenCalledWith('123456');
});

it('asks for a one-time code, and nothing is sent without one', async () => {
  const onSubmit = jest.fn();
  renderEnrollment({ onSubmit });

  const field = screen.getByLabelText(/authentication code/i);
  expect(field).toHaveAttribute('autocomplete', 'one-time-code');
  expect(field).toHaveAttribute('inputmode', 'numeric');

  await user.click(screen.getByRole('button', { name: 'Verify' }));
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the error its parent gives it', () => {
  renderEnrollment({ error: 'Incorrect code. 4 attempts left.' });

  expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code. 4 attempts left.');
});

it('is shut while its parent is busy, and empties the field once it is free again', async () => {
  const onSubmit = jest.fn();
  const { rerender } = renderEnrollment({ onSubmit });
  await user.type(screen.getByLabelText(/authentication code/i), '000000');

  rerender(<TotpEnrollment secret={SECRET} busy error={null} onSubmit={onSubmit} />);
  expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled();
  expect(screen.getByLabelText(/authentication code/i)).toHaveValue('000000');

  rerender(<TotpEnrollment secret={SECRET} busy={false} error="Incorrect code." onSubmit={onSubmit} />);
  expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
  expect(screen.getByLabelText(/authentication code/i)).toHaveValue('');
});
