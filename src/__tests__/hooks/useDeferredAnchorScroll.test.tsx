/**
 * The defect this hook fixes: `history.replaceState` writes a hash and never scrolls, so every
 * button on the comparison screen that "opened" a module changed the address bar and left the
 * page exactly where it was. What is asserted here is both halves — that a request scrolls, and
 * that a request for a section which has not mounted yet is retried instead of lost.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useDeferredAnchorScroll } from '@/hooks/useDeferredAnchorScroll';

const scrollIntoView = jest.fn();

beforeAll(() => {
  // jsdom implements neither
  Element.prototype.scrollIntoView = scrollIntoView;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia;
});

beforeEach(() => {
  scrollIntoView.mockClear();
  (window.matchMedia as jest.Mock).mockReturnValue({ matches: false });
});

/**
 * Stands in for ComparisonDetail: a screen whose sections only exist while it is the open one,
 * and a button that asks to jump to a section of the *other* screen.
 */
function Harness({ target }: { target: string }) {
  const [screenKey, setScreenKey] = useState<'a' | 'b'>('a');
  const requestScroll = useDeferredAnchorScroll(screenKey);

  return (
    <div>
      <button type="button" onClick={() => requestScroll(target)}>
        request
      </button>
      <button type="button" onClick={() => setScreenKey('b')}>
        switch screen
      </button>
      {screenKey === 'a' ? <section id="on-screen-a" /> : <section id="on-screen-b" />}
    </div>
  );
}

describe('useDeferredAnchorScroll', () => {
  it('scrolls to a section already on the open screen', async () => {
    render(<Harness target="on-screen-a" />);

    await userEvent.click(screen.getByRole('button', { name: 'request' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  // The race that made the cross-screen jumps unreliable: at click time the target genuinely
  // does not exist, so firing once and forgetting loses the jump.
  it('holds a request for a section that has not mounted, then scrolls when it does', async () => {
    render(<Harness target="on-screen-b" />);

    await userEvent.click(screen.getByRole('button', { name: 'request' }));
    expect(scrollIntoView).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'switch screen' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('scrolls again when the same section is requested twice', async () => {
    render(<Harness target="on-screen-a" />);

    const request = screen.getByRole('button', { name: 'request' });
    await userEvent.click(request);
    await userEvent.click(request);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('does not animate when the reader asked for less motion', async () => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: true });
    render(<Harness target="on-screen-a" />);

    await userEvent.click(screen.getByRole('button', { name: 'request' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('scrolls nothing until asked', () => {
    render(<Harness target="on-screen-a" />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
