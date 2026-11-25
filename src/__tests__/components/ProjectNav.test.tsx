/**
 * La rangee d'onglets d'un projet.
 *
 * Elle redonne ce que la sidebar portait seule : passer de l'apercu a la
 * preparation, aux analyses, a la multi-comparaison et au nuage de contrastes,
 * avec la raison de chaque verrou. Elle n'existe que sur les routes de projet ;
 * plus bas, c'est le fil d'Ariane qui ramene en arriere.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';

let mockPathname = '/projects/p1';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const mockUseProject = jest.fn();
jest.mock('@/hooks/useProjects', () => ({
  useProject: (...args: unknown[]) => mockUseProject(...args),
}));

// Le profil arrive APRES le premier rendu (requete reseau). Tant qu'il est en vol, les
// vrais hooks rendent `data` vide et `unlocked: false` : c'est ce que la maquette doit
// pouvoir simuler, parce que c'est l'etat dans lequel la rangee est peinte la premiere fois.
let mockPending = false;
let mockScience = true;
jest.mock('@/hooks/useAddOnModules', () => ({
  useScientificModule: () => ({
    unlocked: !mockPending && mockScience,
    loaded: !mockPending,
  }),
}));

let mockPlan = 'TEAM';
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    data: mockPending ? undefined : { subscription_plan: mockPlan, role: 'USER' },
    isPending: mockPending,
  }),
}));

// Le selecteur lit la liste des projets a l'ouverture : hors sujet ici.
jest.mock('@/components/sidebar/ProjectSwitcher', () => ({
  __esModule: true,
  default: ({ projectId, projectLabel }: { projectId: string; projectLabel: string }) => (
    <div data-testid="switcher" data-project={projectId}>
      {projectLabel}
    </div>
  ),
}));

import ProjectNav from '@/components/project/ProjectNav';
import { PLAN_GATE_COPY } from '@/utils/plan';

const SCIENCE_LOCK = 'Scientific tools add-on — ask an admin to enable it';

function renderAt(pathname: string) {
  mockPathname = pathname;
  return render(<ProjectNav projectId="p1" />);
}

const tabs = () => screen.getByRole('navigation', { name: 'Project' });

beforeEach(() => {
  mockPathname = '/projects/p1';
  mockScience = true;
  mockPlan = 'TEAM';
  mockPending = false;
  mockUseProject.mockReset();
  mockUseProject.mockReturnValue({ data: { name: 'Skin Study' } });
});

describe('ProjectNav on a project-level route', () => {
  it('is a labelled landmark carrying the tour anchor', () => {
    renderAt('/projects/p1');
    expect(tabs()).toHaveAttribute('data-tour', 'nav-project');
  });

  it('offers the five sections in order, each a link to its route', () => {
    renderAt('/projects/p1');
    const links = within(tabs()).getAllByRole('link');
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Overview', '/projects/p1'],
      ['Setup', '/projects/p1/setup'],
      ['Analyses', '/projects/p1/analyses'],
      ['Multi-comparison', '/projects/p1/multi-comparison'],
      ['Contrast scatter', '/projects/p1/contrast-scatter'],
    ]);
  });

  it('shows the switcher with the project name, above the tabs', () => {
    renderAt('/projects/p1');
    const switcher = screen.getByTestId('switcher');
    expect(switcher).toHaveTextContent('Skin Study');
    expect(switcher).toHaveAttribute('data-project', 'p1');
    expect(tabs().compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('falls back on the id while the project name loads', () => {
    mockUseProject.mockReturnValue({ data: undefined });
    renderAt('/projects/p1');
    expect(screen.getByTestId('switcher')).toHaveTextContent('p1');
  });

  it.each([
    ['/projects/p1', 'Overview'],
    ['/projects/p1/setup', 'Setup'],
    ['/projects/p1/analyses', 'Analyses'],
    ['/projects/p1/analyses/new', 'Analyses'],
    ['/projects/p1/multi-comparison', 'Multi-comparison'],
    ['/projects/p1/contrast-scatter', 'Contrast scatter'],
  ])('marks exactly one tab current on %s: %s', (pathname, label) => {
    renderAt(pathname);
    const current = within(tabs())
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual([label]);
  });

  it('keeps the tab row on one line and scrollable sideways', () => {
    renderAt('/projects/p1');
    const scroller = tabs();
    expect(scroller.className).toContain('overflow-x-auto');
    expect(scroller.className).not.toMatch(/flex-wrap/);
    for (const a of within(scroller).getAllByRole('link')) {
      expect(a.className).toContain('shrink-0');
      expect(a.className).toContain('whitespace-nowrap');
    }
  });

  it('makes every tab at least 44px tall', () => {
    mockPlan = 'STARTER';
    mockScience = false;
    renderAt('/projects/p1');
    const items = Array.from(tabs().children) as HTMLElement[];
    expect(items).toHaveLength(5);
    for (const item of items) expect(item.className).toContain('min-h-11');
  });
});

describe('locked sections', () => {
  it('renders Multi-comparison as a disabled span, not a link, when the plan lacks it', () => {
    mockPlan = 'STARTER';
    renderAt('/projects/p1');

    expect(within(tabs()).queryByRole('link', { name: /Multi-comparison/ })).toBeNull();
    const locked = within(tabs()).getByText('Multi-comparison').closest('[aria-disabled]') as HTMLElement;
    expect(locked.tagName).toBe('SPAN');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).not.toHaveAttribute('href');
    // Raison en infobulle ET lisible par un lecteur d'ecran.
    expect(locked).toHaveAttribute('title', PLAN_GATE_COPY.multiComparison);
    expect(locked).toHaveTextContent(PLAN_GATE_COPY.multiComparison);
    expect(locked.querySelector('svg')).not.toBeNull();
  });

  it('renders Contrast scatter as a disabled span with the add-on reason without the add-on', () => {
    mockScience = false;
    renderAt('/projects/p1');

    expect(within(tabs()).queryByRole('link', { name: /Contrast scatter/ })).toBeNull();
    const locked = within(tabs()).getByText('Contrast scatter').closest('[aria-disabled]') as HTMLElement;
    expect(locked.tagName).toBe('SPAN');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAttribute('title', SCIENCE_LOCK);
    expect(locked).toHaveTextContent(SCIENCE_LOCK);
  });

  it('locks the two independently: the plan does not unlock the add-on, nor the reverse', () => {
    mockPlan = 'TEAM';
    mockScience = false;
    renderAt('/projects/p1');
    expect(within(tabs()).getByRole('link', { name: 'Multi-comparison' })).toBeInTheDocument();
    expect(within(tabs()).queryByRole('link', { name: /Contrast scatter/ })).toBeNull();
  });

  it('leaves Overview, Setup and Analyses as links whatever the gates', () => {
    mockPlan = 'STARTER';
    mockScience = false;
    renderAt('/projects/p1');
    expect(within(tabs()).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual([
      'Overview',
      'Setup',
      'Analyses',
    ]);
  });

  it('never marks a locked tab as the current page', () => {
    mockPlan = 'STARTER';
    renderAt('/projects/p1/multi-comparison');
    expect(tabs().querySelector('[aria-current="page"]')).toBeNull();
  });
});

describe('ProjectNav on a deep route', () => {
  it.each([
    '/projects/p1/analyses/a1',
    '/projects/p1/analyses/a1/comparisons/A_vs_B',
    '/projects/p1/comparisons/A_vs_B',
    '/projects/p1/datasets/d1',
  ])('renders nothing on %s', (pathname) => {
    const { container } = renderAt(pathname);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not fetch the project there', () => {
    renderAt('/projects/p1/analyses/a1');
    expect(mockUseProject).toHaveBeenCalledWith('p1', false);
  });
});

describe('while the profile is still loading', () => {
  // `canUseMultiComparison(undefined)` et `unlocked` valent `false` tant que `/users/me`
  // n'a pas repondu : lus tels quels, ils peignaient un cadenas et « ask an admin to enable
  // it » a un utilisateur qui a le droit, le temps d'une requete.
  it('draws no lock and no reason on the two gated tabs', () => {
    mockPending = true;
    renderAt('/projects/p1');

    expect(tabs().querySelector('[aria-disabled]')).toBeNull();
    expect(tabs().querySelector('svg')).toBeNull();
    expect(tabs()).not.toHaveTextContent(/ask an admin|plan/i);
    expect(within(tabs()).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual([
      'Overview',
      'Setup',
      'Analyses',
      'Multi-comparison',
      'Contrast scatter',
    ]);
  });

  it('locks them once the profile arrives and says the user is not entitled', () => {
    mockPending = true;
    mockPlan = 'STARTER';
    mockScience = false;
    const { rerender } = renderAt('/projects/p1');
    expect(tabs().querySelector('[aria-disabled]')).toBeNull();

    mockPending = false;
    rerender(<ProjectNav projectId="p1" />);
    const locked = Array.from(tabs().querySelectorAll('[aria-disabled="true"]'));
    expect(locked.map((el) => el.getAttribute('title'))).toEqual([
      PLAN_GATE_COPY.multiComparison,
      SCIENCE_LOCK,
    ]);
  });
});

describe('bringing the current tab into view', () => {
  // jsdom n'a pas de mise en page : offsetLeft, offsetWidth, clientWidth valent 0. On leur
  // donne une geometrie — l'onglet courant a 500px dans une rangee de 300px, large de 100 — et
  // on ecoute les ecritures de `scrollLeft`, qui est le seul effet observable de la rangee.
  // Centrer l'onglet : 500 - (300 - 100) / 2 = 400.
  let scrolls: number[];

  beforeEach(() => {
    scrolls = [];
    jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('aria-current') === 'page' ? 500 : 0;
    });
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    jest.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(0);
    jest.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation((value: number) => {
      scrolls.push(value);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scrolls the row to an off-screen current tab on arrival', () => {
    renderAt('/projects/p1/contrast-scatter');
    expect(scrolls).toEqual([400]);
  });

  it('does not scroll when the current tab is already in view', () => {
    jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(20);
    renderAt('/projects/p1/analyses');
    expect(scrolls).toEqual([]);
  });

  it('scrolls to a gated current tab on a direct arrival, before the profile has answered', () => {
    mockPending = true;
    renderAt('/projects/p1/multi-comparison');
    expect(tabs().querySelector('[aria-current="page"]')).not.toBeNull();
    expect(scrolls).toEqual([400]);
  });

  it('scrolls when the current tab turns from locked into a link', () => {
    // Profil deja la, sans le droit : l'onglet est un span verrouille, rien a ramener.
    mockPlan = 'STARTER';
    const { rerender } = renderAt('/projects/p1/multi-comparison');
    expect(tabs().querySelector('[aria-current="page"]')).toBeNull();
    expect(scrolls).toEqual([]);

    // Le plan monte (le profil est relu) : le meme onglet devient un lien, courant, hors champ.
    mockPlan = 'TEAM';
    rerender(<ProjectNav projectId="p1" />);
    expect(tabs().querySelector('[aria-current="page"]')).not.toBeNull();
    expect(scrolls).toEqual([400]);
  });

  it('does not scroll again on an unrelated re-render', () => {
    const { rerender } = renderAt('/projects/p1/contrast-scatter');
    rerender(<ProjectNav projectId="p1" />);
    rerender(<ProjectNav projectId="p1" />);
    expect(scrolls).toEqual([400]);
  });
});
