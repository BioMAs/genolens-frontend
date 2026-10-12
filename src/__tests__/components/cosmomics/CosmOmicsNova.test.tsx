/**
 * CosmOmics nova — rendering, interactions, accessibility, add-on gate.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import CosmOmicsNova from '@/components/cosmomics/CosmOmicsNova';
import CosmOmicsNovaView from '@/components/cosmomics/CosmOmicsNovaView';
import type { CosmOmicsNovaData } from '@/types/cosmomics';

jest.mock('@/hooks/useIsDemoAccount', () => ({ useIsDemoAccount: () => false }));

const mockProfile = jest.fn();
const mockNova = jest.fn();
jest.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfile() }));
jest.mock('@/hooks/useCosmOmicsNova', () => ({
  useCosmOmicsNova: (...args: unknown[]) => mockNova(...args),
  useCosmOmicsInterpretation: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));

const data = mock as unknown as CosmOmicsNovaData;

describe('CosmOmicsNova', () => {
  it('renders the reference fixture as a stable SVG (snapshot, dust off)', () => {
    const { container } = render(<CosmOmicsNova data={data} seed="mock-dataset" showDust={false} />);
    const svg = container.querySelector('svg')!;
    expect(svg.outerHTML.replace(/nova-hatch-[\w-]+/g, 'nova-hatch')).toMatchSnapshot();
  });

  it('draws one bubble per sub-group, no line to the centre and no pathway name', () => {
    const { container } = render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    const bubbles = container.querySelectorAll('circle[data-subgroup]');
    const nSub = data.claims.reduce((n, c) => n + c.subgroups.length, 0) + data.unlinked.length;
    expect(bubbles).toHaveLength(nSub);
    // The only <line> is the hatch stroke, inside the pattern definition.
    expect(container.querySelectorAll('line')).toHaveLength(1);
    expect(container.querySelector('line')!.closest('pattern')).not.toBeNull();
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(texts).not.toContain('Collagen biosynthesis');
    expect(texts).toContain('Regeneration');
    expect(texts).toContain('Active');
  });

  it('labels every sector and bubble for assistive technology', () => {
    render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    expect(screen.getByRole('button', { name: /^Firming: 5 pathways for, coherence 91%$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Antioxidant: 3 pathways for, 1 against/ })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /^Mitochondrial respiration, p = .*, contradicts — Antioxidant$/ }),
    ).toBeInTheDocument();
  });

  it('selects a claim on sector click and on Enter', () => {
    const onSelect = jest.fn();
    render(<CosmOmicsNova data={data} seed="mock-dataset" onSelectClaim={onSelect} />);
    const firming = screen.getByRole('button', { name: /^Firming/ });
    fireEvent.click(firming.querySelector('path')!);
    expect(onSelect).toHaveBeenLastCalledWith('Firming');
    fireEvent.keyDown(screen.getByRole('button', { name: /^Barrier/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith('Barrier');
  });

  it('shows the terms of a bubble on hover', () => {
    render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    fireEvent.mouseEnter(screen.getByRole('img', { name: /^Collagen biosynthesis,/ }));
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('Collagen biosynthesis')).toBeInTheDocument();
    expect(within(tip).getByText(/R-HSA-1650814/)).toBeInTheDocument();
    expect(tip.textContent).toMatch(/pro/);
    fireEvent.mouseLeave(screen.getByRole('img', { name: /^Collagen biosynthesis,/ }));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('CosmOmicsNovaView', () => {
  it('opens the strongest claim, then the clicked one, with its three best sub-groups', () => {
    render(<CosmOmicsNovaView data={data} seed="mock-dataset" filename="nova" />);
    expect(screen.getByRole('region', { name: 'Regeneration claim card' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Antioxidant: / }).querySelector('path')!);
    const card = screen.getByRole('region', { name: 'Antioxidant claim card' });
    expect(within(card).getByText('3 pathways for · 1 against')).toBeInTheDocument();
    expect(within(card).getByText('coherence 63%')).toBeInTheDocument();
    const items = within(card).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatch(/^↑NRF2 response/);
    // Contradicting sub-group: grey arrow, still listed among the three best.
    expect(items.some((t) => t?.startsWith('↓Mitochondrial respiration'))).toBe(true);
  });

  it('keeps every value reachable without a mouse, in a details table', () => {
    const { container } = render(<CosmOmicsNovaView data={data} seed="mock-dataset" filename="nova" />);
    const details = container.querySelector('details')!;
    const rows = within(details).getAllByRole('row');
    const nSub = data.claims.reduce((n, c) => n + c.subgroups.length, 0) + data.unlinked.length;
    expect(rows).toHaveLength(nSub + 1);
  });

  it('carries the reference legend', () => {
    render(<CosmOmicsNovaView data={data} seed="mock-dataset" filename="nova" />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    for (const text of [
      'Sub-group: terms for → against the claim',
      'Individual ontology term',
      'Evidence against the claim (hatched)',
      'Size = |Δ pro − anti|',
      'Sector width = claim importance (Σ −log10 p of its terms)',
    ]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
  });
});

describe('CosmOmicsPanel add-on gate', () => {
  // Required after the mocks above are registered.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CosmOmicsPanel = require('@/components/cosmomics/CosmOmicsPanel').default;

  beforeEach(() => {
    mockNova.mockReset();
    mockNova.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it('never queries the nova for a user without the Skin claims flag', () => {
    mockProfile.mockReturnValue({ data: { role: 'USER', has_cosmetics_module: false }, isLoading: false });
    render(<CosmOmicsPanel datasetId="ds-1" comparisonName="A_vs_B" />);
    expect(screen.getByText('CosmOmics is an add-on')).toBeInTheDocument();
    expect(mockNova).toHaveBeenCalledWith('ds-1', 'A_vs_B', false);
  });

  it('queries and draws the nova for a user with the flag', () => {
    mockProfile.mockReturnValue({ data: { role: 'USER', has_cosmetics_module: true }, isLoading: false });
    mockNova.mockReturnValue({ data, isLoading: false, error: null });
    const { container } = render(<CosmOmicsPanel datasetId="ds-1" comparisonName="A_vs_B" />);
    expect(mockNova).toHaveBeenCalledWith('ds-1', 'A_vs_B', true);
    expect(container.querySelector('[data-cosmomics-nova]')).not.toBeNull();
  });

  it('says so when no claim has a significant pathway', () => {
    mockProfile.mockReturnValue({ data: { role: 'ADMIN' }, isLoading: false });
    mockNova.mockReturnValue({
      data: { ...data, claims: [], coverage: { n_terms: 12, n_terms_significant: 9, n_terms_matched: 0 } },
      isLoading: false,
      error: null,
    });
    render(<CosmOmicsPanel datasetId="ds-1" comparisonName="A_vs_B" />);
    expect(screen.getByText('No claim has a significant pathway')).toBeInTheDocument();
  });
});
