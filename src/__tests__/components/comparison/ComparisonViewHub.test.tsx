/**
 * The hub is the only place the four-screen split is visible from the results page, so what it
 * asserts is the structure itself: four cards, in the order that makes the numbering mean
 * something, each saying what it holds and what is out of reach.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparisonViewHub from '@/components/comparison/ComparisonViewHub';
import {
  buildComparisonModules,
  groupModulesByView,
  type ComparisonViewGroup,
} from '@/components/comparison/comparisonModules';
import { VIEW_LABELS, VIEW_ORDER } from '@/components/comparison/comparisonRoutes';

const FULL_ACCESS = {
  hasMatrix: true,
  hasEnrichmentFile: true,
  cosmeticsUnlocked: true,
  reportUnlocked: true,
  scienceUnlocked: true,
  drugDiscoveryUnlocked: true,
  stats: { degUp: 1860, degDown: 1150, degTotal: 3010 },
};

const groupsFor = (overrides: Partial<typeof FULL_ACCESS> = {}): ComparisonViewGroup[] =>
  groupModulesByView(buildComparisonModules({ ...FULL_ACCESS, ...overrides }));

function renderHub(
  groups = groupsFor(),
  activeView: (typeof VIEW_ORDER)[number] = 'explorer',
  onSelect = jest.fn()
) {
  render(<ComparisonViewHub groups={groups} activeView={activeView} onSelect={onSelect} />);
  return onSelect;
}

describe('ComparisonViewHub', () => {
  it('shows one card per screen, in the order the numbering claims', () => {
    renderHub();

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(VIEW_ORDER.length);
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
      VIEW_ORDER.map((view) => `Open ${VIEW_LABELS[view]}`)
    );
  });

  it('marks only the open screen as current', () => {
    renderHub(groupsFor(), 'appliquer');

    expect(screen.getByRole('button', { name: 'Open Apply' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Open Explore' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('opens the screen the reader clicked', async () => {
    const onSelect = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Open Understand' }));

    expect(onSelect).toHaveBeenCalledWith('comprendre');
  });

  it('counts the sections of each screen', () => {
    renderHub();

    // Explore holds six: overview, DEG table, method stats, heatmap, lookup, free-form charts
    expect(screen.getByRole('button', { name: 'Open Explore' })).toHaveTextContent('6 sections');
    expect(screen.getByRole('button', { name: 'Open Share' })).toHaveTextContent('2 sections');
  });

  // The reason to count at all: a screen whose modules are all out of reach used to look
  // identical to one that was ready, because the sidebar simply dimmed the entries.
  it('says how much of a screen is out of reach', () => {
    renderHub(
      groupsFor({ hasMatrix: false, cosmeticsUnlocked: false, drugDiscoveryUnlocked: false })
    );

    const apply = screen.getByRole('button', { name: 'Open Apply' });
    expect(apply).toHaveTextContent('2 locked');
    expect(apply).toHaveTextContent('1 needs data');
  });

  it('still shows a screen that holds nothing for this comparison', () => {
    const groups = groupsFor().map((group) =>
      group.view === 'partager'
        ? { ...group, modules: [], counts: { ready: 0, 'needs-data': 0, locked: 0 } }
        : group
    );
    renderHub(groups);

    expect(screen.getByRole('button', { name: 'Open Share' })).toHaveTextContent(
      'Nothing here for this comparison'
    );
  });
});
