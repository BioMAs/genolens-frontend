import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RecoveryCodesPanel from '@/components/auth/RecoveryCodesPanel';
import { captureDownloads } from '@/test-utils/downloads';

const CODES = ['AAAAA-BBBBB', 'CCCCC-DDDDD'];

let user: ReturnType<typeof userEvent.setup>;
let downloads: ReturnType<typeof captureDownloads>;
let writeText: jest.Mock;

const renderPanel = (props: Partial<React.ComponentProps<typeof RecoveryCodesPanel>> = {}) =>
  render(<RecoveryCodesPanel codes={CODES} doneLabel="Done" onDone={jest.fn()} {...props} />);

beforeEach(() => {
  user = userEvent.setup();
  downloads = captureDownloads();
  // `userEvent.setup()` installs its own clipboard stub; replace it with one we can read.
  writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  downloads.restore();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

it('lists every code', () => {
  renderPanel();

  const items = within(screen.getByTestId('recovery-codes')).getAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual(CODES);
});

it('downloads the codes as text, one per line', async () => {
  renderPanel();

  await user.click(screen.getByRole('button', { name: /download/i }));

  expect(await downloads.files()).toEqual([
    { filename: 'genolens-recovery-codes.txt', text: 'AAAAA-BBBBB\nCCCCC-DDDDD\n' },
  ]);
});

it('copies the codes to the clipboard, and says so', async () => {
  renderPanel();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();

  await user.click(screen.getByRole('button', { name: 'Copy' }));

  expect(writeText).toHaveBeenCalledWith('AAAAA-BBBBB\nCCCCC-DDDDD\n');
  expect(await screen.findByRole('status')).toHaveTextContent(/copied/i);
});

it('does not claim a copy that did not happen', async () => {
  writeText.mockRejectedValue(new Error('denied'));
  renderPanel();

  await user.click(screen.getByRole('button', { name: 'Copy' }));

  expect(writeText).toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('survives a browser without a clipboard', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  renderPanel();

  await user.click(screen.getByRole('button', { name: 'Copy' }));

  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('keeps the way out shut until the codes are acknowledged', async () => {
  const onDone = jest.fn();
  renderPanel({ doneLabel: 'Continue to GenoLens', onDone });

  const done = screen.getByRole('button', { name: 'Continue to GenoLens' });
  expect(done).toBeDisabled();

  await user.click(screen.getByRole('checkbox', { name: /i have saved these codes/i }));
  expect(done).toBeEnabled();
  await user.click(done);

  expect(onDone).toHaveBeenCalledTimes(1);
});

it('shuts the way out again when the acknowledgement is withdrawn', async () => {
  renderPanel();
  const ack = screen.getByTestId('recovery-ack');

  await user.click(ack);
  await user.click(ack);

  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
});
