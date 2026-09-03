/**
 * Deferring a heavy section until it is scrolled near.
 *
 * The behaviour worth pinning is the failure mode: when there is no `IntersectionObserver` at
 * all — an old browser, or jsdom — the section must still appear. A missing optimisation is
 * acceptable; a permanently missing panel is not.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useMountOnIntersection } from '@/hooks/useMountOnIntersection';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers: Array<{ callback: ObserverCallback; disconnected: boolean }> = [];

function installObserver() {
  class FakeObserver {
    private entry: { callback: ObserverCallback; disconnected: boolean };
    constructor(callback: ObserverCallback) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    disconnect() {
      this.entry.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
}

function removeObserver() {
  delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
}

function Section() {
  const { attach, visible, reveal } = useMountOnIntersection<HTMLDivElement>();
  return (
    <div ref={attach}>
      {visible ? (
        <p>heavy panel</p>
      ) : (
        <button type="button" onClick={reveal}>
          load now
        </button>
      )}
    </div>
  );
}

afterEach(() => {
  observers.length = 0;
  removeObserver();
});

describe('with an observer', () => {
  beforeEach(installObserver);

  it('withholds the panel until the section comes near', () => {
    render(<Section />);

    expect(screen.queryByText('heavy panel')).toBeNull();
    expect(screen.getByRole('button', { name: 'load now' })).toBeInTheDocument();
  });

  it('mounts once the section intersects', () => {
    render(<Section />);

    act(() => observers[0].callback([{ isIntersecting: true }]));

    expect(screen.getByText('heavy panel')).toBeInTheDocument();
  });

  it('stops observing after the first intersection', () => {
    render(<Section />);

    act(() => observers[0].callback([{ isIntersecting: true }]));

    expect(observers[0].disconnected).toBe(true);
  });

  // A section already paid for must not unmount on the way past, or it is paid for twice.
  it('never goes back to hidden', () => {
    render(<Section />);

    act(() => observers[0].callback([{ isIntersecting: true }]));
    act(() => observers[0].callback([{ isIntersecting: false }]));

    expect(screen.getByText('heavy panel')).toBeInTheDocument();
  });

  it('ignores a callback that reports nothing intersecting', () => {
    render(<Section />);

    act(() => observers[0].callback([{ isIntersecting: false }]));

    expect(screen.queryByText('heavy panel')).toBeNull();
  });

  it('mounts immediately when asked explicitly', async () => {
    render(<Section />);

    await userEvent.click(screen.getByRole('button', { name: 'load now' }));

    expect(screen.getByText('heavy panel')).toBeInTheDocument();
  });
});

describe('without an observer', () => {
  // The important failure mode: no observer must mean "show everything", never "show nothing".
  it('mounts the panel anyway', async () => {
    removeObserver();
    render(<Section />);

    await waitFor(() => expect(screen.getByText('heavy panel')).toBeInTheDocument());
  });
});
