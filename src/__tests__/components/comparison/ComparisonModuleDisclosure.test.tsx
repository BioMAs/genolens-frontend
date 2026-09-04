/**
 * The disclosure's whole job is scope: it shows the modules of the open screen and no others,
 * so that which of them is locked and which is ready can be read at a glance. That is what is
 * asserted here — the previous catalogue-wide version would fail every one of these.
 */
import { render, screen } from '@testing-library/react';
import ComparisonModuleDisclosure from '@/components/comparison/ComparisonModuleDisclosure';
import {
  buildComparisonModules,
  groupModulesByView,
} from '@/components/comparison/comparisonModules';
import type { ComparisonView } from '@/components/comparison/comparisonRoutes';

const FULL_ACCESS = {
  hasMatrix: true,
  hasEnrichmentFile: true,
  cosmeticsUnlocked: true,
  reportUnlocked: true,
  scienceUnlocked: true,
  drugDiscoveryUnlocked: true,
  stats: { degUp: 1860, degDown: 1150, degTotal: 3010 },
};

const groupFor = (view: ComparisonView, overrides: Partial<typeof FULL_ACCESS> = {}) =>
  groupModulesByView(buildComparisonModules({ ...FULL_ACCESS, ...overrides })).find(
    (group) => group.view === view
  );

function renderDisclosure(group: ReturnType<typeof groupFor>, onOpen = jest.fn()) {
  render(<ComparisonModuleDisclosure group={group} onOpen={onOpen} />);
  return onOpen;
}

describe('ComparisonModuleDisclosure', () => {
  it('lists the open screen and nothing from the others', () => {
    renderDisclosure(groupFor('appliquer'));

    for (const title of ['Drug targets', 'Signature score', 'Skin claims']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // Explore's and Share's modules stay on their own screens
    for (const title of ['DEG table', 'Heatmap & clustering', 'Exports', 'Reporting']) {
      expect(screen.queryByText(title)).toBeNull();
    }
  });

  it('names the screen and counts its states on the closed summary', () => {
    renderDisclosure(groupFor('appliquer', { cosmeticsUnlocked: false, hasMatrix: false }));

    // Readable without opening the disclosure: that is the point of the summary
    const summary = screen.getByText(/Apply modules/);
    expect(summary).toHaveTextContent('1 ready');
    expect(summary).toHaveTextContent('1 waiting on data');
    expect(summary).toHaveTextContent('1 locked');
  });

  it('stays collapsed, being the detail behind a count', () => {
    renderDisclosure(groupFor('explorer'));

    expect(document.querySelector('details')).not.toHaveAttribute('open');
  });

  // The reason the disclosure exists at all: a locked add-on is the one thing you cannot act on
  // from the sidebar, which only dims it.
  it('offers access to a locked add-on of this screen', () => {
    renderDisclosure(groupFor('appliquer', { drugDiscoveryUnlocked: false }));

    expect(screen.getByRole('button', { name: /Request access/ })).toBeInTheDocument();
  });

  it('opens a ready module on its own screen and anchor', async () => {
    const onOpen = renderDisclosure(groupFor('partager'));

    screen.getByRole('button', { name: 'Open Exports' }).click();

    expect(onOpen).toHaveBeenCalledWith('partager', 'exports');
  });

  it('renders nothing when the screen holds no modules', () => {
    const { container } = render(
      <ComparisonModuleDisclosure
        group={{
          view: 'partager',
          label: 'Share',
          description: 'Take the results out of the app',
          modules: [],
          counts: { ready: 0, 'needs-data': 0, locked: 0 },
        }}
        onOpen={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no group at all', () => {
    const { container } = render(
      <ComparisonModuleDisclosure group={undefined} onOpen={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
