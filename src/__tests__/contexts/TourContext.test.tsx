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

  describe('anchors that exist but are not on screen', () => {
    // jsdom n'a pas de mise en page : on pilote `getClientRects` comme le ferait
    // `display:none` dans un navigateur.
    let hidden: Set<Element>;
    beforeEach(() => {
      hidden = new Set();
      jest
        .spyOn(Element.prototype, 'getClientRects')
        .mockImplementation(function (this: Element) {
          return (hidden.has(this) ? [] : [{}]) as unknown as DOMRectList;
        });
    });
    afterEach(() => {
      jest.restoreAllMocks();
      document.body.innerHTML = '';
    });

    const mount = (key: string, visible: boolean) => {
      const el = document.createElement('div');
      el.setAttribute('data-tour', key);
      document.body.appendChild(el);
      if (!visible) hidden.add(el);
    };

    const startedSteps = async () => {
      render(
        <TourProvider>
          <Consumer />
        </TourProvider>,
      );
      await act(async () => {
        screen.getByText('start').click();
        await Promise.resolve();
      });
      const config = driverFactory.mock.calls[0][0] as { steps: { element?: string }[] };
      return config.steps.map((step) => step.element);
    };

    it('drops the steps of an anchor hidden at this width', async () => {
      mount('nav-workspace', false);
      mount('dashboard-welcome', true);
      mount('help-button', false);

      const elements = await startedSteps();
      expect(elements).not.toContain('[data-tour="nav-workspace"]');
      expect(elements).not.toContain('[data-tour="help-button"]');
      expect(elements).toContain('[data-tour="dashboard-welcome"]');
    });

    it('keeps the unanchored welcome step and the anchors that are not mounted', async () => {
      mount('nav-workspace', false);

      const elements = await startedSteps();
      // L'accueil (sans ancre) ouvre toujours la visite ; une ancre pas encore montee reste.
      expect(elements[0]).toBeUndefined();
      expect(elements).toContain('[data-tour="dashboard-kpis"]');
    });

    it('keeps every step on a wide screen', async () => {
      mount('nav-workspace', true);
      mount('help-button', true);

      const elements = await startedSteps();
      expect(elements).toContain('[data-tour="nav-workspace"]');
      expect(elements).toContain('[data-tour="help-button"]');
    });
  });
});
