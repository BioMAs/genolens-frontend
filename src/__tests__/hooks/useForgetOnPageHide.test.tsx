/**
 * A screen that shows a secret (an authenticator key, recovery codes) drops it
 * as the page is left, so the copy the back/forward cache keeps holds none; a
 * page that comes back from that cache having dropped one is reloaded.
 *
 * The reload goes through the navigation seam: jsdom can neither stub nor
 * follow `window.location.reload`.
 */
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';

import { useForgetOnPageHide } from '@/hooks/useForgetOnPageHide';
import { reloadPage } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/navigation', () => ({ reloadPage: jest.fn() }));

const reload = reloadPage as jest.MockedFunction<typeof reloadPage>;

function Secret({ holdsSecret }: { holdsSecret?: boolean }) {
  const [shown, setShown] = useState<string | null>('JBSW Y3DP');
  useForgetOnPageHide(() => setShown(null), holdsSecret);
  return <p data-testid="secret">{shown ?? 'nothing'}</p>;
}

function leave() {
  act(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  });
}

function comeBack(persisted: boolean) {
  act(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted }));
  });
}

beforeEach(() => {
  reload.mockReset();
});

it('drops the secret as the page is left', () => {
  render(<Secret />);
  expect(screen.getByTestId('secret')).toHaveTextContent('JBSW Y3DP');

  leave();

  expect(screen.getByTestId('secret')).toHaveTextContent('nothing');
});

it('reloads a page restored from the back/forward cache after it dropped a secret', () => {
  render(<Secret />);

  leave();
  comeBack(true);

  expect(reload).toHaveBeenCalledTimes(1);
});

it('does not reload on an ordinary page load', () => {
  render(<Secret />);

  comeBack(false);

  expect(reload).not.toHaveBeenCalled();
});

it('leaves a screen alone while it shows no secret', () => {
  render(<Secret holdsSecret={false} />);

  leave();
  comeBack(true);

  expect(screen.getByTestId('secret')).toHaveTextContent('JBSW Y3DP');
  expect(reload).not.toHaveBeenCalled();
});

it('stops listening once unmounted', () => {
  const { unmount } = render(<Secret />);
  unmount();

  leave();
  comeBack(true);

  expect(reload).not.toHaveBeenCalled();
});
