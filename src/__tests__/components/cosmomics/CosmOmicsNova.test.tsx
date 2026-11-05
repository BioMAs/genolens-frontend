/**
 * CosmOmics nova — rendering, interactions, accessibility, add-on gate.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import CosmOmicsNova from '@/components/cosmomics/CosmOmicsNova';
import CosmOmicsNovaView from '@/components/cosmomics/CosmOmicsNovaView';
import NovaClaimCard from '@/components/cosmomics/NovaClaimCard';
import NovaLegend from '@/components/cosmomics/NovaLegend';
import { NOVA_INK } from '@/components/cosmomics/novaPalette';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import honest from '../../fixtures/cosmomics/honestNova.json';

jest.mock('@/hooks/useIsDemoAccount', () => ({ useIsDemoAccount: () => false }));

const mockProfile = jest.fn();
const mockNova = jest.fn();
jest.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfile() }));
jest.mock('@/hooks/useCosmOmicsNova', () => ({
  useCosmOmicsNova: (...args: unknown[]) => mockNova(...args),
  useCosmOmicsInterpretation: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useCosmOmicsSavedInterpretation: () => ({ data: undefined, isLoading: false, error: null }),
}));

const data = mock as unknown as CosmOmicsNovaData;
const honestData = honest as unknown as CosmOmicsNovaData;
const claimB = honestData.claims[1];

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
    // The centre carries the numerator of the contrast, not a made-up "Active".
    expect(texts).toContain('Mock active');
    expect(texts).not.toContain('Active');
  });

  it('labels every sector and bubble for assistive technology', () => {
    render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    expect(screen.getByRole('button', { name: /^Firming: 5 pathways for, coherence 91%$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Antioxidant: 3 pathways for, 1 against/ })).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /^Mitochondrial respiration, combined p = .*, contradicts — Antioxidant$/,
      }),
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

  it('carries the reference legend, worded for adjusted p', () => {
    render(<CosmOmicsNovaView data={data} seed="mock-dataset" filename="nova" />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    for (const text of [
      'Sub-group: terms for → against the claim',
      'Individual ontology term',
      'Evidence against the claim (hatched)',
      'Size = |Δ pro − anti|',
      'Sector width = claim importance (Σ −log10 adj. p of its terms)',
    ]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
  });

  it('draws no decorative dots until asked', () => {
    const { container } = render(<CosmOmicsNovaView data={data} seed="mock-dataset" filename="nova" />);
    const dots = () => container.querySelectorAll('[data-cosmomics-nova] path[d*="a.7,.7"]');
    const toggle = screen.getByRole('checkbox', { name: /decorative/i });
    expect(toggle).not.toBeChecked();
    expect(dots()).toHaveLength(0);
    fireEvent.click(toggle);
    expect(dots().length).toBeGreaterThan(0);
  });

  it('not evaluated claims are listed', () => {
    render(<CosmOmicsNovaView data={honestData} seed="honest" filename="nova" />);
    const section = screen.getByRole('region', { name: 'Claims not evaluated' });
    expect(within(section).getByText('Claim C')).toBeInTheDocument();
    expect(within(section).getByText('Claim D')).toBeInTheDocument();
    expect(section).toHaveTextContent('n.e. — no significant term for this claim in the enrichment results');
  });

  it('says how many not-linked sub-groups exist and how many are drawn', () => {
    render(<CosmOmicsNovaView data={honestData} seed="honest" filename="nova" />);
    expect(screen.getByText(/40 pathways not linked to a claim \(3 drawn\)/)).toBeInTheDocument();
  });

  it('tells what the nova was computed from, and what it left out', () => {
    render(<CosmOmicsNovaView data={honestData} seed="honest" filename="nova" />);
    const how = screen.getByText('How this was computed').closest('details')!;
    expect(how).toHaveTextContent('dataset 3f2a9c1e');
    expect(how).toHaveTextContent('referential v3');
    expect(how).toHaveTextContent('4 not significant at α, still counted');
    expect(how).toHaveTextContent('2 without an adjusted p, left out');
  });
});

describe('legend', () => {
  it('NovaLegend shows not evaluated and balanced, and defines coherence', () => {
    render(<NovaLegend hatchId="h" />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent(
      'Balanced: evidence for and against cancels (Δ = 0), counted neither for nor against',
    );
    expect(legend).toHaveTextContent('n.e. — no significant term for this claim in the enrichment results');
    expect(legend).toHaveTextContent(
      'Coherence = S pro / (S pro + S anti): the share of the evidence weight that goes for the claim, not a probability',
    );
    // R-P1: a stored term that is not significant is not filtered out.
    expect(legend).toHaveTextContent('Faded dot: term not significant at α');
    expect(legend).toHaveTextContent('Terms not significant at α still contribute with their weight.');
  });
});

describe('NovaClaimCard', () => {
  it('NovaClaimCard says 0 against without confirming', () => {
    render(<NovaClaimCard claim={honestData.claims[0]} />);
    const card = screen.getByRole('region', { name: 'Claim A claim card' });
    expect(within(card).getByText('2 pathways for · 0 against')).toBeInTheDocument();
    expect(card).toHaveTextContent('0 against');
    expect(card).toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
    // R-T6-1: the note says it is not a confirmation, and nothing on the card says "confirmed".
    expect(card.textContent).not.toMatch(/confirmed/i);
    expect(card.textContent).not.toMatch(/only significant terms are stored/i);
    // The state is named, in words.
    expect(card).toHaveTextContent('evidence for only, none against');
  });

  it('says nothing about "0 against" when something is against, and counts the balanced ones', () => {
    render(<NovaClaimCard claim={claimB} />);
    const card = screen.getByRole('region', { name: 'Claim B claim card' });
    expect(within(card).getByText('1 pathway for · 1 against · 1 balanced')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
    expect(card).toHaveTextContent('evidence both for and against');
  });

  it('derives the state when the payload does not carry it (reference fixture)', () => {
    const firming = data.claims.find((c) => c.name === 'Firming')!;
    render(<NovaClaimCard claim={firming} />);
    // No sub-group against, yet some of its terms weigh against the claim: both ways.
    expect(screen.getByRole('region', { name: 'Firming claim card' })).toHaveTextContent(
      'evidence both for and against',
    );
    cleanup();
    render(<NovaClaimCard claim={{ ...firming, s_anti: 0 }} />);
    expect(screen.getByRole('region', { name: 'Firming claim card' })).toHaveTextContent(
      'evidence for only, none against',
    );
    cleanup();
    render(<NovaClaimCard claim={{ ...firming, s_pro: 0 }} />);
    expect(screen.getByRole('region', { name: 'Firming claim card' })).toHaveTextContent(
      'evidence against only, none for',
    );
  });

  it('NovaClaimCard colours direction neutrally', () => {
    render(<NovaClaimCard claim={claimB} />);
    const arrows = screen.getAllByLabelText(/-regulated$/, { selector: '[data-direction]' });
    // B1 and B3 are observed up, B2 down.
    expect(arrows.map((a) => a.getAttribute('data-direction')).sort()).toEqual(['down', 'up', 'up']);
    for (const arrow of arrows) {
      expect(arrow).toHaveStyle({ color: NOVA_INK.ink });
      expect(arrow).not.toHaveStyle({ color: NOVA_INK.coral });
      expect(arrow).not.toHaveStyle({ color: NOVA_INK.green });
    }
  });

  it('says in words which side each sub-group stands on, balanced included', () => {
    render(<NovaClaimCard claim={claimB} />);
    const rows = within(screen.getByRole('region', { name: 'Claim B claim card' })).getAllByRole('listitem');
    const row = (name: string) => rows.find((li) => li.textContent?.includes(name))!;
    expect(within(row('Sub-group B1')).getByText('for')).toBeInTheDocument();
    expect(within(row('Sub-group B2')).getByText('against')).toBeInTheDocument();
    expect(within(row('Sub-group B3')).getByText('balanced')).toBeInTheDocument();
  });
});

describe('p labels', () => {
  it('p labels say adjusted for terms and combined for sub-groups', () => {
    const { container } = render(<CosmOmicsNovaView data={honestData} seed="honest" filename="nova" />);
    // Claim card: sub-group p is a combined p.
    const card = screen.getByRole('region', { name: 'Claim A claim card' });
    expect(card).toHaveTextContent(/combined p = /);
    expect(card.textContent).not.toMatch(/adj\. p/);

    // Tooltip: the sub-group's p is combined, each term's p is adjusted.
    fireEvent.mouseEnter(container.querySelector('circle[data-subgroup="Sub-group B2"]')!);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent(/combined p = /);
    expect(tip).toHaveTextContent(/Term B2a.*adj\. p = /);
    expect(tip).toHaveTextContent(/Term B2b.*not significant/);
    fireEvent.mouseLeave(container.querySelector('circle[data-subgroup="Sub-group B2"]')!);

    // Table: the column is the Stouffer combination, the terms carry their adjusted p.
    const table = container.querySelector('details table')!;
    expect(within(table as HTMLElement).getByRole('columnheader', { name: 'Combined p (Stouffer)' })).toBeInTheDocument();
    expect(table).toHaveTextContent(/Term B1a \(adj\. p = /);
    expect(table).toHaveTextContent('not significant at α, still counted');
  });

  it('marks a term enriched in both directions, and counts each sub-group by its side', () => {
    const { container } = render(<CosmOmicsNovaView data={honestData} seed="honest" filename="nova" />);
    const table = container.querySelector('details table') as HTMLElement;
    const row = within(table).getByText('Sub-group B3').closest('tr')!;
    expect(row).toHaveTextContent('balanced');
    expect(row).not.toHaveTextContent('against');
    expect(row).toHaveTextContent('both directions');
    expect(within(table).getByText('Sub-group B2').closest('tr')).toHaveTextContent('against');
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

  it('no enrichment says so', () => {
    mockProfile.mockReturnValue({ data: { role: 'ADMIN' }, isLoading: false });
    mockNova.mockReturnValue({
      data: { ...honestData, status: 'no_enrichment', claims: [], unlinked: [], not_evaluated: [] },
      isLoading: false,
      error: null,
    });
    render(<CosmOmicsPanel datasetId="ds-1" comparisonName="A_vs_B" />);
    expect(screen.getByText('No enrichment results for this comparison')).toBeInTheDocument();
    expect(screen.queryByText('No claim has a significant pathway')).toBeNull();
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
