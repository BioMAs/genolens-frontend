/**
 * The wiring of the comparison screen.
 *
 * This component had no tests, and that is how three broken "open this module" buttons shipped
 * unnoticed: every piece around them was covered — the catalogue, the URL contract, the hub, the
 * disclosure — while the thing that *composes* them was not. So what is exercised here is
 * strictly the composition: which sections a screen renders, what an add-on gate hides, whether
 * the hub and the disclosure agree with the open screen, and whether opening a module moves the
 * page.
 *
 * The panels themselves are stubbed to a marker. They have their own tests, they drag in Plotly,
 * cytoscape and a dozen queries, and none of that is what a wiring test is for.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';
import ComparisonDetail from '@/components/ComparisonDetail';

// ── the URL is the screen ───────────────────────────────────────────────────────────
// Next's `useSearchParams` reflects a native `replaceState` and re-renders (>= 14.1), which is
// the single mechanism the whole screen turns on: `selectView` writes the URL and the component
// re-derives from it. jsdom does not couple the two, so the mock reads the live URL and a
// patched `replaceState` notifies its subscribers. Without this no click could change screen,
// and the composition would be untestable — which is the state that let three broken buttons
// ship.
const mockUrlListeners = new Set<() => void>();

jest.mock('next/navigation', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSearchParams: () => {
      const search = react.useSyncExternalStore(
        (notify: () => void) => {
          mockUrlListeners.add(notify);
          return () => mockUrlListeners.delete(notify);
        },
        () => window.location.search,
        () => ''
      );
      return new URLSearchParams(search);
    },
    usePathname: () => window.location.pathname,
  };
});

jest.mock('@/utils/api');

// ── the two hooks that decide what exists and who may see it ────────────────────────
const mockContext = jest.fn();
jest.mock('@/components/comparison/useComparisonContext', () => ({
  useComparisonContext: (...args: unknown[]) => mockContext(...args),
}));

const mockProfile = jest.fn();
jest.mock('@/hooks/useCosmetics', () => ({
  useUserProfile: () => mockProfile(),
}));

jest.mock('@/contexts/ChatModeContext', () => ({
  useChatMode: () => ({ openChatWith: jest.fn() }),
}));

// Lazily mounted sections resolve immediately: jsdom has no IntersectionObserver, and a test
// asserting on a placeholder would assert on the harness rather than the screen.
jest.mock('@/hooks/useMountOnIntersection', () => ({
  useMountOnIntersection: () => ({ attach: jest.fn(), visible: true, reveal: jest.fn() }),
}));

// ── panels, stubbed to a marker ─────────────────────────────────────────────────────
jest.mock('@/components/DEGBarChart', () => {
  const Stub = () => <div data-testid="DEGBarChart">DEGBarChart</div>;
  Stub.displayName = 'DEGBarChart';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/DEGTable', () => {
  const Stub = () => <div data-testid="DEGTable">DEGTable</div>;
  Stub.displayName = 'DEGTable';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/MethodStatsPanel', () => {
  const Stub = () => <div data-testid="MethodStatsPanel">MethodStatsPanel</div>;
  Stub.displayName = 'MethodStatsPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/AIInterpretationPanel', () => {
  const Stub = () => <div data-testid="AIInterpretationPanel">AIInterpretationPanel</div>;
  Stub.displayName = 'AIInterpretationPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/CustomVisualizationPanel', () => {
  const Stub = () => <div data-testid="CustomVisualizationPanel">CustomVisualizationPanel</div>;
  Stub.displayName = 'CustomVisualizationPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/SignatureScorePanel', () => {
  const Stub = () => <div data-testid="SignatureScorePanel">SignatureScorePanel</div>;
  Stub.displayName = 'SignatureScorePanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/ExportMenu', () => {
  const Stub = () => <div data-testid="ExportMenu">ExportMenu</div>;
  Stub.displayName = 'ExportMenu';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/GOEnrichmentAnalysis', () => {
  const Stub = () => <div data-testid="GOEnrichmentAnalysis">GOEnrichmentAnalysis</div>;
  Stub.displayName = 'GOEnrichmentAnalysis';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/GSEAAnalysis', () => {
  const Stub = () => <div data-testid="GSEAAnalysis">GSEAAnalysis</div>;
  Stub.displayName = 'GSEAAnalysis';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/tools/dd/DrugDiscoveryComparisonPanel', () => {
  const Stub = () => <div data-testid="DrugDiscoveryComparisonPanel">DrugDiscoveryComparisonPanel</div>;
  Stub.displayName = 'DrugDiscoveryComparisonPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/report/ReportCustomizationPanel', () => {
  const Stub = () => <div data-testid="ReportCustomizationPanel">ReportCustomizationPanel</div>;
  Stub.displayName = 'ReportCustomizationPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/network/PPINetworkSection', () => {
  const Stub = () => <div data-testid="PPINetworkSection">PPINetworkSection</div>;
  Stub.displayName = 'PPINetworkSection';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/integrations/StringEnrichmentPanel', () => {
  const Stub = () => <div data-testid="StringEnrichmentPanel">StringEnrichmentPanel</div>;
  Stub.displayName = 'StringEnrichmentPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/analysis/ClusteringAnalysis', () => {
  const Stub = () => <div data-testid="ClusteringAnalysis">ClusteringAnalysis</div>;
  Stub.displayName = 'ClusteringAnalysis';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/cosmetics/CosmeticsTab', () => {
  const Stub = () => <div data-testid="CosmeticsTab">CosmeticsTab</div>;
  Stub.displayName = 'CosmeticsTab';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/ComparisonHeader', () => {
  const Stub = () => <div data-testid="ComparisonHeader">ComparisonHeader</div>;
  Stub.displayName = 'ComparisonHeader';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/ComparisonSynthesis', () => {
  const Stub = () => <div data-testid="ComparisonSynthesis">ComparisonSynthesis</div>;
  Stub.displayName = 'ComparisonSynthesis';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/OverviewTopPathways', () => {
  // Keeps its one outgoing action: it is the only affordance that jumps to another screen,
  // and therefore the only way to exercise a scroll whose target is not yet mounted.
  const Stub = ({ onOpenEnrichment }: { onOpenEnrichment: () => void }) => (
    <button type="button" onClick={onOpenEnrichment}>
      open enrichment
    </button>
  );
  Stub.displayName = 'OverviewTopPathways';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/explorer/VolcanoPanel', () => {
  const Stub = () => <div data-testid="VolcanoPanel">VolcanoPanel</div>;
  Stub.displayName = 'VolcanoPanel';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/explorer/SelectionCard', () => {
  const Stub = () => <div data-testid="SelectionCard">SelectionCard</div>;
  Stub.displayName = 'SelectionCard';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/explorer/GeneListDeepLink', () => {
  const Stub = () => <div data-testid="GeneListDeepLink">GeneListDeepLink</div>;
  Stub.displayName = 'GeneListDeepLink';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/explorer/HeatmapSection', () => {
  const Stub = () => <div data-testid="HeatmapSection">HeatmapSection</div>;
  Stub.displayName = 'HeatmapSection';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/explorer/SynthesisStrip', () => {
  const Stub = () => <div data-testid="SynthesisStrip">SynthesisStrip</div>;
  Stub.displayName = 'SynthesisStrip';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/comparison/comprendre/PathwayFocusBar', () => {
  const Stub = () => <div data-testid="PathwayFocusBar">PathwayFocusBar</div>;
  Stub.displayName = 'PathwayFocusBar';
  return { __esModule: true, default: Stub };
});

// ── fixtures ────────────────────────────────────────────────────────────────────────
const dataset = (id: string, type: DatasetType): Dataset =>
  ({
    id,
    project_id: 'p1',
    name: id,
    dataset_type: type,
    status: DatasetStatus.READY,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    // Present so the statistics effect resolves from metadata and never reaches the network.
    dataset_metadata: { deg_up: 1860, deg_down: 1150, deg_total: 3010 },
  }) as unknown as Dataset;

const FULL_CONTEXT = {
  project: { id: 'p1', name: 'Project' } as unknown as Project,
  datasets: [],
  decodedName: 'KO_vs_WT',
  actualComparisonName: 'KO_vs_WT',
  degDataset: dataset('deg-1', DatasetType.DEG),
  enrichmentDataset: dataset('enr-1', DatasetType.ENRICHMENT),
  matrixDataset: dataset('mtx-1', DatasetType.MATRIX),
  samples: { sampleIds: ['s1', 's2'], conditionMap: { s1: 'KO', s2: 'WT' } },
  geneMap: { genes: ['TP53'], nameByGene: { TP53: 'TP53' } },
  isLoading: false,
  isError: false,
};

const ALL_ADD_ONS = {
  role: 'USER',
  has_cosmetics_module: true,
  has_report_customization: true,
  has_scientific_module: true,
  has_drug_discovery_module: true,
};

function renderDetail({
  search = '',
  context = {},
  profile = {},
}: { search?: string; context?: object; profile?: object } = {}) {
  window.history.replaceState(
    null,
    '',
    `/projects/p1/comparisons/KO_vs_WT${search ? `?${search}` : ''}`
  );
  mockContext.mockReturnValue({ ...FULL_CONTEXT, ...context });
  mockProfile.mockReturnValue({ data: { ...ALL_ADD_ONS, ...profile } });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ComparisonDetail projectId="p1" comparisonName="KO_vs_WT" />
    </QueryClientProvider>
  );
}

/** Section ids actually in the document — the screen's real contents. */
const renderedSections = () =>
  Array.from(document.querySelectorAll('section[id]')).map((s) => s.id);

const nativeReplaceState = window.history.replaceState.bind(window.history);

beforeAll(() => {
  window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    nativeReplaceState(...args);
    mockUrlListeners.forEach((notify) => notify());
  }) as History['replaceState'];
});

afterAll(() => {
  window.history.replaceState = nativeReplaceState;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUrlListeners.clear();
  window.history.replaceState(null, '', '/projects/p1/comparisons/KO_vs_WT');
  // jsdom implements neither
  Element.prototype.scrollIntoView = jest.fn();
  window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
});

describe('which screen renders', () => {
  it('opens on Explore, with its six sections and nothing from elsewhere', () => {
    renderDetail();

    expect(renderedSections()).toEqual([
      'summary',
      'genes',
      'methods',
      'heatmap',
      'external-lookup',
      'custom-viz',
    ]);
  });

  it('renders Apply from ?view=appliquer', () => {
    renderDetail({ search: 'view=appliquer' });

    expect(renderedSections()).toEqual(['drug-discovery', 'signature', 'cosmetics']);
  });

  it('renders Understand and Share from their own parameter', () => {
    const { unmount } = renderDetail({ search: 'view=comprendre' });
    expect(renderedSections()).toEqual(['ai', 'enrichment', 'network']);
    unmount();

    renderDetail({ search: 'view=partager' });
    expect(renderedSections()).toEqual(['exports', 'report']);
  });

  /**
   * The drift this closes, for all four screens at once.
   *
   * A module's screen is data (`comparisonModules`), while the section it anchors is a hardcoded
   * `activeView === …` in the JSX. Nothing makes the two agree: reassign a module and its
   * section stays where it was, so the rail advertises an anchor the screen does not hold, or
   * misses one it does. The order matters for the same reason — the rail names it, and the
   * heatmap used to be rendered after the Share sections.
   *
   * Under full access every module is ready, so the two lists must match exactly.
   */
  it.each([
    ['explorer', ''],
    ['comprendre', 'view=comprendre'],
    ['appliquer', 'view=appliquer'],
    ['partager', 'view=partager'],
  ])('has %s announce exactly the sections it renders, in order', (_view, search) => {
    const { unmount } = renderDetail({ search });

    const rail = screen.getByTestId('section-rail');
    const announced = Array.from(rail.querySelectorAll('a')).map((a) =>
      a.getAttribute('href')?.slice(1)
    );
    expect(announced).toEqual(renderedSections());

    unmount();
  });
});

describe('legacy links', () => {
  it('lands a legacy ?tab= on the screen that inherited it', () => {
    renderDetail({ search: 'tab=signature' });

    expect(renderedSections()).toContain('signature');
  });

  it('lands the retired ?view=outils on Apply', () => {
    renderDetail({ search: 'view=outils' });

    expect(renderedSections()).toEqual(['drug-discovery', 'signature', 'cosmetics']);
  });

  it('rewrites a legacy query out of the address bar', async () => {
    renderDetail({ search: 'tab=enrichment' });

    // Cosmetic cleanup only — the screen already painted Understand from the derivation
    expect(window.location.search).toBe('?view=comprendre');
  });
});

describe('add-on gating', () => {
  it('renders no section for a locked add-on', () => {
    renderDetail({
      search: 'view=appliquer',
      profile: {
        has_drug_discovery_module: false,
        has_scientific_module: false,
        has_cosmetics_module: false,
      },
    });

    expect(renderedSections()).toEqual([]);
    expect(screen.queryByTestId('section-rail')).toBeNull();
  });

  it('keeps admin access without the per-user flags', () => {
    renderDetail({
      search: 'view=appliquer',
      profile: {
        role: 'ADMIN',
        has_drug_discovery_module: false,
        has_scientific_module: false,
        has_cosmetics_module: false,
      },
    });

    expect(renderedSections()).toEqual(['drug-discovery', 'signature', 'cosmetics']);
  });

  // A locked module must stay visible as a capability, which is the disclosure's job — the old
  // behaviour removed its tab entirely and the feature became invisible.
  it('still lists a locked add-on, with a way to ask for it', () => {
    renderDetail({ search: 'view=appliquer', profile: { has_drug_discovery_module: false } });

    expect(screen.getByText('Drug targets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request access/ })).toBeInTheDocument();
  });
});

describe('the hub', () => {
  it('marks the open screen and switches to another on click', async () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Open Explore' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open Apply' }));

    expect(window.location.search).toBe('?view=appliquer');
    expect(renderedSections()).toEqual(['drug-discovery', 'signature', 'cosmetics']);
  });

  it('writes the default screen bare', async () => {
    renderDetail({ search: 'view=partager' });

    await userEvent.click(screen.getByRole('button', { name: 'Open Explore' }));

    expect(window.location.search).toBe('');
  });
});

describe('the module disclosure', () => {
  it('lists the open screen and nothing from the others', () => {
    renderDetail({ search: 'view=appliquer' });

    const disclosure = document.querySelector('details') as HTMLElement;
    expect(within(disclosure).getByText('Signature score')).toBeInTheDocument();
    expect(within(disclosure).queryByText('DEG table')).toBeNull();
  });

  it('follows the open screen when it changes', async () => {
    renderDetail();
    const disclosure = () => document.querySelector('details') as HTMLElement;
    expect(within(disclosure()).getByText('DEG table')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open Share' }));

    expect(within(disclosure()).getByText('Exports')).toBeInTheDocument();
    expect(within(disclosure()).queryByText('DEG table')).toBeNull();
  });
});

// The defect that shipped three times: replaceState writes a hash and never scrolls, so a card
// changed the address bar and left the page where it was.
describe('opening a module', () => {
  it('scrolls to the section of a card on the open screen', async () => {
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Open Method statistics' }));

    expect(window.location.hash).toBe('#methods');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  // The harder half: at click time the target belongs to a screen that is not rendered, so a
  // scroll fired on the spot would find nothing. The Explore summary's jump into Understand is
  // the one place that happens.
  it('scrolls after crossing to another screen, once the section exists', async () => {
    renderDetail();
    expect(document.getElementById('enrichment')).toBeNull();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'open enrichment' }));

    expect(window.location.search).toBe('?view=comprendre');
    expect(window.location.hash).toBe('#enrichment');
    expect(document.getElementById('enrichment')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});

describe('when there is nothing to show', () => {
  it('says so while loading', () => {
    renderDetail({ context: { isLoading: true } });

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(renderedSections()).toEqual([]);
  });

  it('reports a failed load', () => {
    renderDetail({ context: { isError: true } });

    expect(screen.getByText(/Failed to load comparison details/)).toBeInTheDocument();
  });

  it('reports a missing project', () => {
    renderDetail({ context: { project: undefined } });

    expect(screen.getByText('Project not found')).toBeInTheDocument();
  });

  it('reports a comparison with no DEG dataset', () => {
    renderDetail({ context: { degDataset: undefined } });

    expect(screen.getByText(/No Differential Expression \(DEG\) dataset found/)).toBeInTheDocument();
    expect(renderedSections()).toEqual([]);
  });
});
