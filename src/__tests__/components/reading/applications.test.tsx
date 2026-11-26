/**
 * Le chapitre des applications : trois sous-parties, chacune derrière son module.
 *
 * Ce qui pèse le plus ici est le verrou : sans le module, la nova n'est ni demandée au serveur
 * (`useCosmOmicsNova` reçoit `enabled = false`) ni rendue, même floutée, et le bloc verrouillé
 * prend sa place. Les composants de la nova sont simulés (leur dessin a ses propres tests) ;
 * `NovaClaimList`, la rangée de boutons d'allégation, est le vrai.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApplicationsChapter from '@/components/reading/chapters/ApplicationsChapter';
import { LOCKED_COPY } from '@/components/reading/LockedPart';
import { partDomId, type FocusKind } from '@/components/reading/readingRoutes';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { CosmOmicsNovaData, NovaClaim } from '@/types/cosmomics';

jest.mock('@/hooks/useCosmOmicsNova', () => ({ useCosmOmicsNova: jest.fn() }));

jest.mock('@/components/cosmomics/CosmOmicsNova', () => ({
  __esModule: true,
  default: ({
    data,
    seed,
    selectedClaim,
    onSelectClaim,
  }: {
    data: CosmOmicsNovaData;
    seed: string;
    selectedClaim?: string | null;
    onSelectClaim?: (name: string) => void;
  }) => (
    <div data-testid="cosmomics-nova" data-seed={seed} data-selected={selectedClaim ?? ''}>
      {data.claims.map((c) => (
        <button key={c.name} type="button" onClick={() => onSelectClaim?.(c.name)}>
          sector {c.name}
        </button>
      ))}
    </div>
  ),
}));
jest.mock('@/components/cosmomics/NovaClaimCard', () => ({
  __esModule: true,
  ...jest.requireActual('@/components/cosmomics/NovaClaimCard'),
  default: ({ claim }: { claim: NovaClaim }) => <div data-testid="claim-card">{claim.name}</div>,
}));
jest.mock('@/components/cosmomics/NovaLegend', () => ({
  __esModule: true,
  default: ({ hatchId }: { hatchId: string }) => <div data-testid="nova-legend" data-hatch={hatchId} />,
}));

const mockRequest = jest.fn();
jest.mock('@/hooks/useModuleAccessRequest', () => ({
  useModuleAccessRequest: () => ({
    request: mockRequest,
    reset: jest.fn(),
    pending: null,
    notice: null,
    requested: [],
  }),
}));

const mockUseNova = jest.mocked(useCosmOmicsNova);

const claim = (name: string, over: Partial<NovaClaim> = {}): NovaClaim => ({
  name,
  importance: 1,
  s_pro: 2,
  s_anti: 0.5,
  coherence: 0.8,
  n_for: 3,
  n_against: 1,
  subgroups: [],
  ...over,
});

const nova = (over: Partial<CosmOmicsNovaData> = {}): CosmOmicsNovaData =>
  ({
    status: 'ok',
    contrast: 'KO vs WT',
    claims: [claim('Hydration'), claim('Barrier', { coherence: 0.6 })],
    unlinked: [],
    ...over,
  }) as unknown as CosmOmicsNovaData;

const novaResult = (
  over: { data?: CosmOmicsNovaData; isLoading?: boolean; error?: unknown } = {}
): ReturnType<typeof useCosmOmicsNova> =>
  ({ data: undefined, isLoading: false, error: null, ...over }) as unknown as ReturnType<
    typeof useCosmOmicsNova
  >;

const allAccess: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

function renderApplications(
  access: ModuleAccess = allAccess,
  onOpenFocus: (kind: FocusKind) => void = () => {}
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <ApplicationsChapter
          degDatasetId="deg-1"
          comparisonName="KO_vs_WT"
          access={access}
          onOpenFocus={onOpenFocus}
        />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

const part = (name: 'targets' | 'skin' | 'signature') => {
  const element = document.getElementById(partDomId(name));
  if (!element) throw new Error(`no section for ${name}`);
  return element;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNova.mockReturnValue(novaResult({ data: nova() }));
});

describe('ApplicationsChapter — the frame', () => {
  it('is the fifth question, verbatim, with the three applications inside', () => {
    renderApplications();
    const chapter = screen.getByRole('region', { name: 'What can you apply it to?' });
    expect(chapter).toHaveAttribute('id', partDomId('applications'));
    expect(within(chapter).getByRole('heading', { level: 2 })).toHaveTextContent(
      'What can you apply it to?'
    );
    expect(chapter).toContainElement(part('targets'));
    expect(chapter).toContainElement(part('skin'));
    expect(chapter).toContainElement(part('signature'));
  });

  it('gives each application a section with the id of its part and an h3 named after it', () => {
    renderApplications();
    expect(screen.getByRole('region', { name: 'Drug targets' })).toBe(part('targets'));
    expect(screen.getByRole('region', { name: 'Skin claims' })).toBe(part('skin'));
    expect(screen.getByRole('region', { name: 'Signature score' })).toBe(part('signature'));
    for (const title of ['Drug targets', 'Skin claims', 'Signature score']) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
  });
});

describe('ApplicationsChapter — drug targets', () => {
  it('says what it does and opens the targets focus', async () => {
    const onOpenFocus = jest.fn();
    renderApplications(allAccess, onOpenFocus);
    expect(
      within(part('targets')).getByText('Ranks the genes that move here by how druggable they are.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rank targets' }));
    expect(onOpenFocus).toHaveBeenCalledWith('targets');
  });

  it('shows the locked block, not the button, without the drug discovery module', async () => {
    renderApplications({ ...allAccess, targets: false });
    const section = part('targets');
    expect(within(section).getByText(LOCKED_COPY.targets.title)).toBeInTheDocument();
    expect(within(section).getByText(LOCKED_COPY.targets.body)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rank targets' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Drug targets' })).queryByText(
        'Ranks the genes that move here by how druggable they are.'
      )
    ).not.toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Ask for access' }));
    expect(mockRequest).toHaveBeenCalledWith('drugdiscovery');
  });
});

describe('ApplicationsChapter — signature score', () => {
  it('says what it does and opens the signature focus', async () => {
    const onOpenFocus = jest.fn();
    renderApplications(allAccess, onOpenFocus);
    expect(
      within(part('signature')).getByText('Scores every sample of the study against a gene list you choose.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Score samples' }));
    expect(onOpenFocus).toHaveBeenCalledWith('signature');
  });

  it('shows the locked block, not the button, without the scientific module', async () => {
    renderApplications({ ...allAccess, science: false });
    const section = part('signature');
    expect(within(section).getByText(LOCKED_COPY.signature.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Score samples' })).not.toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Ask for access' }));
    expect(mockRequest).toHaveBeenCalledWith('science');
  });
});

describe('ApplicationsChapter — skin claims, locked', () => {
  it('does not fetch CosmOmics without the module', () => {
    renderApplications({ ...allAccess, skin: false });
    expect(mockUseNova).toHaveBeenCalled();
    // Le troisième argument est `enabled` ; `alpha` garde sa valeur par défaut.
    expect(jest.mocked(useCosmOmicsNova).mock.calls[0][2]).toBe(false);
    expect(mockUseNova.mock.calls.every((call) => call[2] === false)).toBe(true);
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
    expect(screen.getByText('Skin claims need the CosmOmics module')).toBeInTheDocument();
  });

  it('renders nothing of the nova behind the block: no card, no legend, no claim button', () => {
    renderApplications({ ...allAccess, skin: false });
    const section = part('skin');
    expect(within(section).queryByTestId('claim-card')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('nova-legend')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /Hydration|Barrier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Evidence table' })).not.toBeInTheDocument();
  });

  it('asks for the claim module from the block', async () => {
    renderApplications({ ...allAccess, skin: false });
    await userEvent.click(within(part('skin')).getByRole('button', { name: 'Ask for access' }));
    expect(mockRequest).toHaveBeenCalledWith('claim');
  });

  it('shows neither the lock nor the nova until the profile has arrived, and still does not fetch', () => {
    renderApplications({
      skin: false,
      targets: false,
      science: false,
      report: false,
      ai: false,
      loaded: false,
    });
    expect(mockUseNova.mock.calls.every((call) => call[2] === false)).toBe(true);
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask for access' })).not.toBeInTheDocument();
    // Les trois sous-parties attendent, chacune avec sa propre ligne d'état.
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual([
      'Loading…',
      'Loading…',
      'Loading…',
    ]);
  });
});

describe('ApplicationsChapter — skin claims, unlocked', () => {
  it('fetches the nova of the comparison, enabled', () => {
    renderApplications();
    expect(mockUseNova).toHaveBeenCalledWith('deg-1', 'KO_vs_WT', true);
  });

  it('mounts the nova with its seed, and the first claim picked by default', () => {
    renderApplications();
    const novaElement = screen.getByTestId('cosmomics-nova');
    expect(novaElement).toHaveAttribute('data-seed', 'deg-1|KO_vs_WT');
    expect(novaElement).toHaveAttribute('data-selected', 'Hydration');
    expect(screen.getByTestId('claim-card')).toHaveTextContent('Hydration');
  });

  it('shows the card of the claim picked in the nova', async () => {
    renderApplications();
    await userEvent.click(screen.getByRole('button', { name: 'sector Barrier' }));
    expect(screen.getByTestId('claim-card')).toHaveTextContent('Barrier');
    expect(screen.getByTestId('cosmomics-nova')).toHaveAttribute('data-selected', 'Barrier');
  });

  it('has a row of claim buttons, pressed for the one that is open, that picks a claim too', async () => {
    renderApplications();
    const hydration = screen.getByRole('button', { name: /^Hydration · 80%/ });
    const barrier = screen.getByRole('button', { name: /^Barrier · 60%/ });
    expect(hydration).toHaveAttribute('aria-pressed', 'true');
    expect(barrier).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(barrier);
    expect(barrier).toHaveAttribute('aria-pressed', 'true');
    expect(hydration).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('claim-card')).toHaveTextContent('Barrier');
    expect(screen.getByTestId('cosmomics-nova')).toHaveAttribute('data-selected', 'Barrier');
  });

  it('keeps one card open at a time, and the legend under the nova', () => {
    renderApplications();
    expect(screen.getAllByTestId('claim-card')).toHaveLength(1);
    expect(screen.getByTestId('nova-legend').getAttribute('data-hatch')).toMatch(/^nova-legend-[\w-]+$/);
  });

  it('falls back to the first claim when the picked one is no longer in the data', async () => {
    const { rerender } = renderApplications();
    await userEvent.click(screen.getByRole('button', { name: 'sector Barrier' }));
    expect(screen.getByTestId('claim-card')).toHaveTextContent('Barrier');

    mockUseNova.mockReturnValue(novaResult({ data: nova({ claims: [claim('Hydration')] }) }));
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ComparisonSelectionProvider>
          <ApplicationsChapter
            degDatasetId="deg-1"
            comparisonName="KO_vs_WT"
            access={allAccess}
            onOpenFocus={() => {}}
          />
        </ComparisonSelectionProvider>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('claim-card')).toHaveTextContent('Hydration');
  });

  it('opens the claims focus from the evidence table button', async () => {
    const onOpenFocus = jest.fn();
    renderApplications(allAccess, onOpenFocus);
    await userEvent.click(screen.getByRole('button', { name: 'Evidence table' }));
    expect(onOpenFocus).toHaveBeenCalledWith('claims');
  });

  it('shows a loading status while the nova is computed', () => {
    mockUseNova.mockReturnValue(novaResult({ isLoading: true }));
    renderApplications();
    expect(within(part('skin')).getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
  });

  it('says so when the nova could not be computed', () => {
    mockUseNova.mockReturnValue(novaResult({ error: new Error('500') }));
    renderApplications();
    expect(within(part('skin')).getByText('No CosmOmics results')).toBeInTheDocument();
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
  });

  it('says so when no enrichment is stored for the comparison', () => {
    mockUseNova.mockReturnValue(novaResult({ data: nova({ status: 'no_enrichment', claims: [] }) }));
    renderApplications();
    expect(
      within(part('skin')).getByText('No enrichment results for this comparison')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
  });

  it('says so when no claim has a significant pathway', () => {
    mockUseNova.mockReturnValue(
      novaResult({ data: nova({ claims: [], coverage: { n_terms_significant: 4 } as never }) })
    );
    renderApplications();
    const section = part('skin');
    expect(within(section).getByText('No claim has a significant pathway')).toBeInTheDocument();
    expect(within(section).getByText(/4 enriched terms at adjusted p < 0.05/)).toBeInTheDocument();
    expect(screen.queryByTestId('cosmomics-nova')).not.toBeInTheDocument();
  });

  it('keeps the evidence table button in every unlocked state: the focus view says why', () => {
    mockUseNova.mockReturnValue(novaResult({ error: new Error('500') }));
    renderApplications();
    expect(screen.getByRole('button', { name: 'Evidence table' })).toBeInTheDocument();
  });
});

describe('ApplicationsChapter — the action table', () => {
  it.each([
    ['Rank targets', 'targets'],
    ['Evidence table', 'claims'],
    ['Score samples', 'signature'],
  ])('%s opens the %s focus', async (label, kind) => {
    const onOpenFocus = jest.fn();
    renderApplications(allAccess, onOpenFocus);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(onOpenFocus).toHaveBeenCalledTimes(1);
    expect(onOpenFocus).toHaveBeenCalledWith(kind);
  });

  it('shows no action at all when the three modules are missing', () => {
    renderApplications({ ...allAccess, skin: false, targets: false, science: false });
    expect(screen.queryByRole('button', { name: /Rank targets|Evidence table|Score samples/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ask for access' })).toHaveLength(3);
  });
});
