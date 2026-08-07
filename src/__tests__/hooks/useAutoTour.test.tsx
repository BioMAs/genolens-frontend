import { render, act } from '@testing-library/react';
import { useAutoTour } from '@/hooks/useAutoTour';
import { hasSeenTour, markTourSeen } from '@/lib/tours/storage';

const startTour = jest.fn();
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ startTour, restartCurrentTour: jest.fn(), currentTourId: null }),
}));

function Harness() {
  useAutoTour('dashboard');
  // The dashboard tour's first element-anchored step targets sidebar-workspace.
  return <div data-tour="sidebar-workspace" />;
}

describe('useAutoTour', () => {
  beforeEach(() => {
    localStorage.clear();
    startTour.mockClear();
    // rAF runs its callback synchronously-ish for the test
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
  });
  afterEach(() => (window.requestAnimationFrame as jest.Mock).mockRestore());

  it('starts the tour once and marks it seen when the anchor exists', () => {
    act(() => {
      render(<Harness />);
    });
    expect(startTour).toHaveBeenCalledWith('dashboard');
    expect(hasSeenTour('dashboard', 1)).toBe(true);
  });

  it('does not start the tour if already seen', () => {
    markTourSeen('dashboard', 1);
    act(() => {
      render(<Harness />);
    });
    expect(startTour).not.toHaveBeenCalled();
  });
});
