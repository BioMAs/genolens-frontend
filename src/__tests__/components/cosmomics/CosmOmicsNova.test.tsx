/**
 * CosmOmics nova — rendering, interactions, accessibility, add-on gate.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import CosmOmicsNova from '@/components/cosmomics/CosmOmicsNova';
import CosmOmicsNovaView from '@/components/cosmomics/CosmOmicsNovaView';
import NovaClaimCard from '@/components/cosmomics/NovaClaimCard';
import NovaLegend from '@/components/cosmomics/NovaLegend';
import { NOVA } from '@/components/cosmomics/novaLayout';
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
    // The only <line> that is not a label's leader is the hatch stroke, inside the pattern definition.
    expect(container.querySelectorAll('line:not([data-leader])')).toHaveLength(1);
    expect(container.querySelector('line:not([data-leader])')!.closest('pattern')).not.toBeNull();
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(texts).not.toContain('Collagen biosynthesis');
    expect(texts).toContain('Regeneration');
    // The centre carries the numerator of the contrast, not a made-up "Active": 8 characters at most
    // fit in the disc, so a longer name is cut and its full form is the tooltip.
    expect(texts).toContain('Mock ac…');
    expect(texts).not.toContain('Active');
    expect(container.querySelector('svg title')!.textContent).toBe('Mock active');
  });

  it('ties a label that was pushed off its place to its sector, under the labels', () => {
    const { container } = render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    // On the reference fixture only "Not linked to a claim" is pushed (off the wheel): one leader.
    const leaders = container.querySelectorAll('line[data-leader]');
    expect(leaders).toHaveLength(1);
    const leader = leaders[0];
    expect(leader.getAttribute('data-leader')).toBe('other');
    const [x1, y1] = ['x1', 'y1'].map((a) => Number(leader.getAttribute(a)));
    expect(Math.hypot(x1 - NOVA.cx, y1 - NOVA.cy)).toBeCloseTo(NOVA.R + 6, 6);
    expect(leader.getAttribute('stroke')).toBe(NOVA_INK.againstText); // the label's title colour
    expect(leader.getAttribute('stroke-width')).toBe('0.8');
    expect(leader.getAttribute('opacity')).toBe('0.6');
    expect(leader.closest('g[aria-hidden]')).not.toBeNull();
    // Drawn before every label, so under their text.
    const firstLabel = container.querySelector('[data-claim-label]')!;
    expect(leader.compareDocumentPosition(firstLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('prints the centre name at the size the disc can hold, with the full name in a title', () => {
    const centreOf = (condition: string) => {
      const { container } = render(<CosmOmicsNova data={{ ...data, condition, contrast: '' }} seed="mock-dataset" />);
      const title = container.querySelector('svg title');
      const text = title?.parentElement?.querySelector('text') ?? null;
      const nTexts = container.querySelectorAll('svg text').length;
      cleanup();
      return {
        title: title?.textContent ?? null,
        text: text?.textContent ?? null,
        size: text?.getAttribute('font-size'),
        nTexts,
      };
    };
    expect(centreOf('A')).toMatchObject({ title: 'A', text: 'A', size: '13' });
    expect(centreOf('Control')).toMatchObject({ title: 'Control', text: 'Control', size: '11' });
    expect(centreOf('Treatment_C')).toMatchObject({ title: 'Treatment_C', text: 'Treatme…', size: '11' });
    // No name: no text and no title, the disc stays.
    const empty = centreOf('');
    expect(empty).toMatchObject({ title: null, text: null });
    expect(empty.nTexts).toBe(centreOf('A').nTexts - 1);
  });

  it('labels every sector and bubble for assistive technology', () => {
    render(<CosmOmicsNova data={data} seed="mock-dataset" />);
    expect(screen.getByRole('button', { name: /^Firming: 5 sub-groups for, coherence 91%$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Antioxidant: 3 sub-groups for, 1 against/ })).toBeInTheDocument();
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
    expect(within(card).getByText('3 sub-groups for · 1 against')).toBeInTheDocument();
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
    expect(screen.getByText(/40 sub-groups not linked to a claim \(3 drawn\)/)).toBeInTheDocument();
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

describe('unit words', () => {
  it('counts sub-groups as sub-groups, never as pathways', () => {
    for (const nova of [honestData, data]) {
      const { container, unmount } = render(<CosmOmicsNovaView data={nova} seed="units" filename="nova" />);
      // Everything a reader or a screen reader gets: visible text and accessible names.
      const labels = Array.from(container.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label'));
      const everything = [container.textContent, ...labels].join(' | ');
      expect(everything).not.toMatch(/\b\d+ pathways?\b/i);
      expect(everything).toMatch(/\b\d+ sub-groups? for\b/);
      expect(everything).toMatch(/\b\d+ sub-groups? not linked to a claim/);
      unmount();
    }
    // The same words on the card of a claim, and on the aria label of its sector.
    render(<CosmOmicsNovaView data={honestData} seed="units" filename="nova" />);
    expect(screen.getByRole('button', { name: /^Claim A: 2 sub-groups for, coherence 100%$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Claim B: 1 sub-group for, 1 against, 1 balanced, coherence 55%$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /: significant sub-groups attached to no claim$/ })).toBeInTheDocument();
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
    expect(within(card).getByText('2 sub-groups for · 0 against')).toBeInTheDocument();
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
    expect(within(card).getByText('1 sub-group for · 1 against · 1 balanced')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
    expect(card).toHaveTextContent('evidence both for and against');
  });

  it('keeps the "no contrary term" note for a claim that has no contrary term, and only for it', () => {
    const firming = data.claims.find((c) => c.name === 'Firming')!;
    // Firming has no sub-group against (n_against 0) but contrary terms inside sub-groups that
    // go for it: "both ways". A note saying there is no contrary term would be false.
    expect(firming.n_against).toBe(0);
    expect(firming.s_anti).toBeGreaterThan(0);
    render(<NovaClaimCard claim={firming} />);
    let card = screen.getByRole('region', { name: 'Firming claim card' });
    expect(within(card).getByText('5 sub-groups for · 0 against')).toBeInTheDocument();
    expect(card).toHaveTextContent('evidence both for and against');
    expect(card).not.toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
    cleanup();

    // The same when its only contrary term sits in a balanced sub-group (payload with a state).
    const balancedOnly = {
      ...claimB,
      state: 'both_ways' as const,
      n_for: 1,
      n_against: 0,
      n_balanced: 1,
      subgroups: [claimB.subgroups[0], claimB.subgroups[2]],
      s_anti: 3,
    };
    render(<NovaClaimCard claim={balancedOnly} />);
    card = screen.getByRole('region', { name: 'Claim B claim card' });
    expect(card).toHaveTextContent('1 sub-group for · 0 against · 1 balanced');
    expect(card).not.toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
    cleanup();

    // Without any contrary term the note is there, for a payload with or without a state.
    render(<NovaClaimCard claim={{ ...firming, s_anti: 0 }} />);
    expect(screen.getByRole('region', { name: 'Firming claim card' })).toHaveTextContent('only terms present in the enrichment results can count against a claim; no contrary term is not a confirmation');
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
