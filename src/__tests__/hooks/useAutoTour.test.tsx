import { render, act } from '@testing-library/react';
import { useAutoTour } from '@/hooks/useAutoTour';
import { hasSeenTour, markTourSeen } from '@/lib/tours/storage';
import type { TourId } from '@/lib/tours/registry';

const startTour = jest.fn();
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ startTour, restartCurrentTour: jest.fn(), currentTourId: null }),
}));

function Harness({ id = 'dashboard' }: { id?: TourId }) {
  useAutoTour(id);
  return null;
}

/** Les elements sans boite de mise en page (display:none) : jsdom n'a pas de mise en page. */
let hidden: Set<Element>;

/** Un element ancre, visible par defaut. */
function mount(key: string, { visible = true }: { visible?: boolean } = {}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour', key);
  document.body.appendChild(el);
  if (!visible) hidden.add(el);
  return el;
}

/** Les images demandees et pas encore jouees : on les avance a la main. */
let frames: FrameRequestCallback[];
const nextFrame = () => {
  const due = frames;
  frames = [];
  act(() => due.forEach((cb) => cb(0)));
};

describe('useAutoTour', () => {
  beforeEach(() => {
    localStorage.clear();
    startTour.mockClear();
    hidden = new Set();
    frames = [];
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => frames.push(cb));
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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

  it('starts the tour once and marks it seen when the anchor exists', () => {
    mount('nav-workspace');
    render(<Harness />);
    nextFrame();
    expect(startTour).toHaveBeenCalledTimes(1);
    expect(startTour).toHaveBeenCalledWith('dashboard');
    expect(hasSeenTour('dashboard', 1)).toBe(true);
  });

  it('does not start the tour if already seen', () => {
    markTourSeen('dashboard', 1);
    mount('nav-workspace');
    render(<Harness />);
    nextFrame();
    expect(startTour).not.toHaveBeenCalled();
  });

  it('starts the project tour once the project tabs exist', () => {
    render(<Harness id="project-overview" />);
    nextFrame();
    expect(startTour).not.toHaveBeenCalled();

    mount('nav-project');
    nextFrame();
    expect(startTour).toHaveBeenCalledWith('project-overview');
    expect(hasSeenTour('project-overview', 1)).toBe(true);
  });

  it('does not wait for the old sidebar anchor', () => {
    mount('sidebar-project');
    render(<Harness id="project-overview" />);
    nextFrame();
    expect(startTour).not.toHaveBeenCalled();
  });

  describe('an anchor that exists but is not visible (desktop bar below 60rem)', () => {
    it('does not start on the hidden first anchor', () => {
      mount('nav-workspace', { visible: false });
      render(<Harness />);
      nextFrame();
      nextFrame();
      expect(startTour).not.toHaveBeenCalled();
      expect(hasSeenTour('dashboard', 1)).toBe(false);
    });

    it('waits for the first VISIBLE anchored step, then starts', () => {
      mount('nav-workspace', { visible: false });
      render(<Harness />);
      nextFrame();
      expect(startTour).not.toHaveBeenCalled();

      mount('dashboard-welcome');
      nextFrame();
      expect(startTour).toHaveBeenCalledWith('dashboard');
      expect(hasSeenTour('dashboard', 1)).toBe(true);
    });

    it('does not start if no anchor is ever visible, and leaves the tour unseen', () => {
      mount('nav-workspace', { visible: false });
      mount('dashboard-welcome', { visible: false });
      render(<Harness />);
      for (let i = 0; i < 70; i += 1) nextFrame();
      expect(startTour).not.toHaveBeenCalled();
      expect(hasSeenTour('dashboard', 1)).toBe(false);
    });
  });

  it('stops polling after about a second when the anchors never appear', () => {
    render(<Harness />);
    for (let i = 0; i < 70; i += 1) nextFrame();
    expect(startTour).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
});
