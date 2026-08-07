// src/__tests__/contexts/TourContext.test.tsx
import { render, screen, act } from '@testing-library/react';
import { TourProvider, useTour } from '@/contexts/TourContext';

// driver.js touches layout APIs jsdom lacks; mock it and assert we drive it.
const drive = jest.fn();
const driverFactory = jest.fn((_cfg: unknown) => ({ drive }));
jest.mock('driver.js', () => ({ driver: (cfg: unknown) => driverFactory(cfg) }));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

let usePathnameValue = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameValue,
}));

function Consumer() {
  const { startTour, currentTourId } = useTour();
  return (
    <div>
      <span data-testid="current">{currentTourId ?? 'none'}</span>
      <button onClick={() => startTour('dashboard')}>start</button>
    </div>
  );
}

describe('TourContext', () => {
  beforeEach(() => {
    drive.mockClear();
    driverFactory.mockClear();
    usePathnameValue = '/dashboard';
  });

  it('exposes the current tour id for the active route', () => {
    render(
      <TourProvider>
        <Consumer />
      </TourProvider>,
    );
    expect(screen.getByTestId('current').textContent).toBe('dashboard');
  });

  it('drives a tour when startTour is called', async () => {
    render(
      <TourProvider>
        <Consumer />
      </TourProvider>,
    );
    await act(async () => {
      screen.getByText('start').click();
      // allow the dynamic import promise to resolve
      await Promise.resolve();
    });
    expect(driverFactory).toHaveBeenCalledTimes(1);
    expect(drive).toHaveBeenCalledTimes(1);
  });
});
