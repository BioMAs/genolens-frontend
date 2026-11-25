/**
 * Which part of the reading is being read.
 *
 * jsdom has no layout, so each part's `getBoundingClientRect().top`, the viewport height, the
 * scroll offset and the document height are set by hand. The reading line sits at 30 % of the
 * viewport by default: with `innerHeight` at 1000, a part is "read" once its top is at or above 300.
 */
import { act, renderHook } from '@testing-library/react';
import { partDomId, type ReadingPart } from '@/components/reading/readingRoutes';
import { useActivePart } from '@/components/reading/useActivePart';

const PAGE_HEIGHT = 5000;
const VIEWPORT = 1000;

let sections: HTMLElement[] = [];
let tops: Partial<Record<ReadingPart, number>> = {};

function setViewport(innerHeight: number, scrollY: number, scrollHeight: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
}

/** Puts one section per entry in the page, each reporting the given top. `tops` stays editable. */
function layoutParts(next: Partial<Record<ReadingPart, number>>) {
  tops = { ...next };
  (Object.keys(next) as ReadingPart[]).forEach((part) => {
    const el = document.createElement('section');
    el.id = partDomId(part);
    el.getBoundingClientRect = () => ({ top: tops[part] ?? 0 }) as DOMRect;
    document.body.appendChild(el);
    sections.push(el);
  });
}

function scrollToBottom() {
  setViewport(VIEWPORT, PAGE_HEIGHT - VIEWPORT, PAGE_HEIGHT);
}

/** Moves the page, then lets the hook see the event. */
function scrollTo(next: Partial<Record<ReadingPart, number>>, event: 'scroll' | 'resize' = 'scroll') {
  tops = { ...tops, ...next };
  act(() => {
    window.dispatchEvent(new Event(event));
  });
}

beforeEach(() => {
  // Top of a tall page: the bottom rule must not fire unless a test scrolls there.
  setViewport(VIEWPORT, 0, PAGE_HEIGHT);
});

afterEach(() => {
  sections.forEach((el) => el.remove());
  sections = [];
  jest.restoreAllMocks();
});

describe('useActivePart', () => {
  it('marks the part whose top passed the reading line', () => {
    layoutParts({ answers: -900, counts: -200, genes: 400 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('counts');
  });

  it('counts a part whose top sits exactly on the line as read', () => {
    layoutParts({ answers: -900, counts: 300, genes: 301 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('counts');
  });

  it('marks the last part at the bottom of the page, even if its top never reached the line', () => {
    layoutParts({ answers: -900, counts: -200, genes: 700 });
    scrollToBottom();
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('genes');
  });

  it('treats the last few pixels above the bottom as the bottom', () => {
    layoutParts({ answers: -900, counts: -200, genes: 700 });
    setViewport(VIEWPORT, PAGE_HEIGHT - VIEWPORT - 4, PAGE_HEIGHT);
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('genes');
  });

  it('falls back to the answers when no part has passed the line yet', () => {
    layoutParts({ answers: 120, counts: 900, genes: 1700 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('answers');
  });

  it('falls back to the answers when none of the parts is in the page', () => {
    const { result } = renderHook(() => useActivePart(['counts', 'genes']));
    expect(result.current).toBe('answers');
  });

  it('skips a part that is not rendered', () => {
    // `genes` is locked and not in the page: tracking carries on across the gap.
    layoutParts({ answers: -900, counts: -400, processes: -10 });
    const { result } = renderHook(() =>
      useActivePart(['answers', 'counts', 'genes', 'processes'])
    );
    expect(result.current).toBe('processes');
  });

  it('marks the last part that IS rendered at the bottom of the page', () => {
    layoutParts({ answers: -900, counts: 700 });
    scrollToBottom();
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('counts');
  });

  it('follows the page as it scrolls', () => {
    layoutParts({ answers: -100, counts: 500, genes: 1300 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts', 'genes']));
    expect(result.current).toBe('answers');

    scrollTo({ answers: -600, counts: 0, genes: 800 });
    expect(result.current).toBe('counts');

    scrollTo({ answers: -1400, counts: -800, genes: 0 });
    expect(result.current).toBe('genes');

    scrollTo({ answers: -100, counts: 500, genes: 1300 });
    expect(result.current).toBe('answers');
  });

  it('recomputes when the window is resized', () => {
    layoutParts({ answers: -900, counts: 350 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts']));
    expect(result.current).toBe('answers');

    // A taller window moves the line from 300 to 600: `counts` is now above it.
    setViewport(2000, 0, PAGE_HEIGHT);
    scrollTo({}, 'resize');
    expect(result.current).toBe('counts');
  });

  it('takes the reading line as a fraction of the viewport', () => {
    layoutParts({ answers: -900, counts: 450 });
    const { result } = renderHook(() => useActivePart(['answers', 'counts'], 0.5));
    expect(result.current).toBe('counts');
  });

  it('listens to scroll passively and to resize, and lets go of both on unmount', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    layoutParts({ answers: 0 });

    const { unmount } = renderHook(() => useActivePart(['answers']));

    const scrollAdd = add.mock.calls.find(([type]) => type === 'scroll');
    const resizeAdd = add.mock.calls.find(([type]) => type === 'resize');
    expect(scrollAdd?.[2]).toEqual(expect.objectContaining({ passive: true }));
    expect(resizeAdd).toBeDefined();

    unmount();
    const removed = (type: string, listener: unknown) =>
      remove.mock.calls.some(([t, fn]) => t === type && fn === listener);
    expect(removed('scroll', scrollAdd?.[1])).toBe(true);
    expect(removed('resize', resizeAdd?.[1])).toBe(true);
  });

  it('does not re-subscribe when the parts array is a new but equal array each render', () => {
    const add = jest.spyOn(window, 'addEventListener');
    layoutParts({ answers: 0, counts: 500 });
    const { rerender } = renderHook(() => useActivePart(['answers', 'counts']));
    const subscribed = add.mock.calls.filter(([type]) => type === 'scroll').length;

    rerender();
    rerender();
    expect(add.mock.calls.filter(([type]) => type === 'scroll').length).toBe(subscribed);
  });

  it('stops reacting to scroll once unmounted', () => {
    layoutParts({ answers: -100, counts: 500 });
    const { result, unmount } = renderHook(() => useActivePart(['answers', 'counts']));
    unmount();
    scrollTo({ answers: -900, counts: 0 });
    expect(result.current).toBe('answers');
  });
});
