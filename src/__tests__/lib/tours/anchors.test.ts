/**
 * Les ancres d'une visite : lesquelles sont reellement a l'ecran.
 *
 * `data-tour="nav-workspace"` et `help-button` sont dans le DOM a toutes les
 * largeurs, mais `display:none` sous 60rem (leurs entrees vivent alors dans le
 * tiroir). driver.js choisit sa cible par `querySelector` : il la trouve, la
 * mesure a 0x0 et pose la bulle dans le coin de la page. Une etape dont l'ancre
 * existe sans etre visible doit donc etre ignoree, et l'ouverture automatique
 * attendre la premiere ancre VISIBLE.
 *
 * jsdom n'a pas de mise en page : `getClientRects()` y renvoie toujours une liste
 * vide. Ces tests la pilotent donc par element (`layout`), comme un navigateur le
 * ferait avec `display:none`.
 */
import type { DriveStep } from 'driver.js';
import { isAnchorRendered, isTourReady, renderedSteps } from '@/lib/tours/anchors';

/** Les elements dont la mise en page est « vide » (display:none, detaches). */
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

function mount(key: string, { visible = true }: { visible?: boolean } = {}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour', key);
  document.body.appendChild(el);
  if (!visible) hidden.add(el);
  return el;
}

const at = (key: string): DriveStep => ({
  element: `[data-tour="${key}"]`,
  popover: { title: key },
});
const floating: DriveStep = { popover: { title: 'floating' } };

describe('isAnchorRendered', () => {
  it('is true for an element that takes up space', () => {
    expect(isAnchorRendered(mount('a'))).toBe(true);
  });

  it('is false for an element with no layout box', () => {
    expect(isAnchorRendered(mount('a', { visible: false }))).toBe(false);
  });
});

describe('renderedSteps', () => {
  it('drops a step whose anchor exists but is not visible', () => {
    mount('nav', { visible: false });
    mount('hero');
    expect(renderedSteps([floating, at('nav'), at('hero')]).map((s) => s.popover?.title)).toEqual([
      'floating',
      'hero',
    ]);
  });

  it('keeps steps with no anchor, an anchor not mounted yet, or a function anchor', () => {
    const byFunction: DriveStep = { element: () => document.body, popover: { title: 'fn' } };
    expect(renderedSteps([floating, at('later'), byFunction])).toHaveLength(3);
  });

  it('does not mutate the tour definition', () => {
    mount('nav', { visible: false });
    const steps = [at('nav'), floating];
    renderedSteps(steps);
    expect(steps).toHaveLength(2);
  });
});

describe('isTourReady', () => {
  it('is ready at once when the tour has no anchored step', () => {
    expect(isTourReady([floating])).toBe(true);
  });

  it('waits while the first anchored step is not mounted', () => {
    expect(isTourReady([floating, at('nav'), at('hero')])).toBe(false);
  });

  it('is ready when the first anchored step is mounted and visible', () => {
    mount('nav');
    expect(isTourReady([floating, at('nav'), at('hero')])).toBe(true);
  });

  it('steps over a hidden anchor and waits for the next one', () => {
    mount('nav', { visible: false });
    expect(isTourReady([at('nav'), at('hero')])).toBe(false);
    mount('hero');
    expect(isTourReady([at('nav'), at('hero')])).toBe(true);
  });

  it('never becomes ready if every anchor is hidden', () => {
    mount('nav', { visible: false });
    mount('hero', { visible: false });
    expect(isTourReady([at('nav'), at('hero')])).toBe(false);
  });
});
