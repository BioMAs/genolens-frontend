/**
 * The wiring of the comparison screen.
 *
 * This component had no tests, and that is how three broken "open this module" buttons shipped
 * unnoticed: every piece around them was covered — the catalogue, the URL contract, the hub, the
 * disclosure — while the thing that *composes* them was not. So what is exercised here is
 * strictly the composition: which tabs a screen offers and which one is open, what an add-on
 * gate hides, whether the hub and the disclosure agree with the open screen, and whether opening
 * a module moves the page.
 *
 * The panels themselves are stubbed to a marker. They have their own tests, they drag in Plotly,
 * cytoscape and a dozen queries, and none of that is what a wiring test is for.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';
import ComparisonDetail from '@/components/ComparisonDetail';
import api from '@/utils/api';
import { captureDownloads } from '@/test-utils/downloads';

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
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => mockProfile(),
}));

jest.mock('@/contexts/ChatModeContext', () => ({
  useChatMode: () => ({ openChatWith: jest.fn() }),
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

// ExportMenu is left real: it is light, and the Share screen's export is wiring worth testing —
// it shipped once rendering a menu with no data behind it.

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

jest.mock('@/components/cosmomics/CosmOmicsPanel', () => {
  const Stub = () => <div data-testid="CosmOmicsPanel">CosmOmicsPanel</div>;
  Stub.displayName = 'CosmOmicsPanel';
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

/** Names of the module tabs, in order — what the screen offers. */
const tabNames = () =>
  screen.queryAllByRole('tab').map((tab) => tab.textContent?.trim() ?? '');

/** The tab currently open. */
const selectedTab = () =>
  screen.queryAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');

const EXPLORE_TABS = [
  'Overview',
  'DEG table',
  'Method statistics',
  'Heatmap & clustering',
  'Database lookup',
  'Free-form charts',
];

/** Render from a URL that carries a fragment, which `renderDetail` cannot express. */
function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  mockContext.mockReturnValue(FULL_CONTEXT);
  mockProfile.mockReturnValue({ data: ALL_ADD_ONS });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComparisonDetail projectId="p1" comparisonName="KO_vs_WT" />
    </QueryClientProvider>
  );
}

describe('which screen renders', () => {
  it('opens on Explore, on its first module, with every module of it as a tab', () => {
    renderDetail();

    expect(tabNames()).toEqual(EXPLORE_TABS);
    expect(selectedTab()).toHaveTextContent('Overview');
    expect(renderedSections()).toEqual(['summary']);
  });

  it('renders Apply from ?view=appliquer', () => {
    renderDetail({ search: 'view=appliquer' });

    expect(tabNames()).toEqual(['Drug targets', 'Signature score', 'CosmOmics']);
    expect(renderedSections()).toEqual(['drug-discovery']);
  });

  // Skin claims became CosmOmics. Old bookmarks (`?tab=cosmetics`, `#cosmetics`) must land on
  // the nova.
  it('lands old Skin claims links on CosmOmics', () => {
    renderDetail({ search: 'tab=cosmetics' });

    expect(renderedSections()).toEqual(['cosmomics']);
    expect(document.getElementById('cosmetics')?.closest('section')?.id).toBe('cosmomics');
    expect(screen.getByTestId('CosmOmicsPanel')).toBeInTheDocument();
  });

  it('renders Understand and Share from their own parameter', () => {
    const { unmount } = renderDetail({ search: 'view=comprendre' });
    expect(tabNames()).toEqual(['AI reading', 'Enrichment', 'Interaction network']);
    expect(renderedSections()).toEqual(['ai']);
    unmount();

    renderDetail({ search: 'view=partager' });
    expect(tabNames()).toEqual(['Exports', 'Reporting']);
    expect(renderedSections()).toEqual(['exports']);
  });

  /**
   * The drift this closes, for all four screens at once.
   *
   * A module's screen is data (`comparisonModules`), while the section it renders is a hardcoded
   * `activePanel === …` in the JSX. Nothing makes the two agree: reassign a module and its tab
   * would open onto nothing. So every tab of every screen is opened, and must show exactly its
   * own section, labelled by it.
   */
  it.each([
    ['explorer', ''],
    ['comprendre', 'view=comprendre'],
    ['appliquer', 'view=appliquer'],
    ['partager', 'view=partager'],
  ])('has every tab of %s open exactly its own panel', async (_view, search) => {
    const { unmount } = renderDetail({ search });

    for (const tab of screen.getAllByRole('tab')) {
      await userEvent.click(tab);
      const sections = Array.from(document.querySelectorAll('section[id]'));
      expect(sections).toHaveLength(1);
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(tab).toHaveAttribute('aria-controls', sections[0].id);
      expect(sections[0]).toHaveAttribute('role', 'tabpanel');
      expect(sections[0]).toHaveAttribute('aria-labelledby', tab.id);
    }

    unmount();
  });
});

describe('the module tabs', () => {
  it('opens a module in place and writes it to the URL, without moving the page', async () => {
    renderDetail();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();

    await userEvent.click(screen.getByRole('tab', { name: 'Method statistics' }));

    expect(window.location.search).toBe('?panel=methods');
    expect(renderedSections()).toEqual(['methods']);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('opens the module ?panel= names', () => {
    renderDetail({ search: 'view=comprendre&panel=network' });

    expect(selectedTab()).toHaveTextContent('Interaction network');
    expect(screen.getByTestId('PPINetworkSection')).toBeInTheDocument();
  });

  // A module this user cannot open must not paint a tab that does not exist.
  it('falls back to the first module when the one asked for is not open here', () => {
    renderDetail({
      search: 'view=appliquer&panel=signature',
      profile: { has_scientific_module: false },
    });

    expect(tabNames()).toEqual(['Drug targets', 'CosmOmics']);
    expect(renderedSections()).toEqual(['drug-discovery']);
  });

  // Roving focus: one tab stop for the whole list, arrows to move within it, and no module
  // mounted on the way past — opening the interaction network is not a side effect of an arrow.
  it('moves focus with the arrow keys and opens only on Enter', async () => {
    renderDetail({ search: 'view=comprendre' });
    const [ai, enrichment, network] = screen.getAllByRole('tab');
    expect(ai).toHaveAttribute('tabindex', '0');
    expect(enrichment).toHaveAttribute('tabindex', '-1');

    ai.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(network).toHaveFocus();
    expect(renderedSections()).toEqual(['ai']);

    await userEvent.keyboard('{Enter}');
    expect(renderedSections()).toEqual(['network']);

    await userEvent.keyboard('{ArrowRight}');
    expect(ai).toHaveFocus();
  });
});

describe('legacy links', () => {
  it('lands a legacy ?tab= on the screen and the module that inherited it', () => {
    renderDetail({ search: 'tab=signature' });

    expect(renderedSections()).toEqual(['signature']);
  });

  it('lands the retired ?view=outils on Apply', () => {
    renderDetail({ search: 'view=outils' });

    expect(renderedSections()).toEqual(['drug-discovery']);
  });

  it('rewrites a legacy query out of the address bar, keeping its module', async () => {
    renderDetail({ search: 'tab=enrichment' });

    // Cosmetic cleanup only — the screen already painted Understand from the derivation
    expect(window.location.search).toBe('?view=comprendre&panel=enrichment');
  });

  // Bookmarks from the scrolling layout named their module with an anchor.
  it('opens the module an old #anchor named, and moves it into ?panel=', () => {
    renderAt('/projects/p1/comparisons/KO_vs_WT?view=comprendre#network');

    expect(renderedSections()).toEqual(['network']);
    expect(window.location.search).toBe('?view=comprendre&panel=network');
    expect(window.location.hash).toBe('');
  });

  // `#gsea` is not a module but the ranked half of one: it opens Enrichment and stays.
  it('opens Enrichment from #gsea and keeps the fragment its mode lives in', () => {
    renderAt('/projects/p1/comparisons/KO_vs_WT?view=comprendre#gsea');

    expect(renderedSections()).toEqual(['enrichment']);
    expect(screen.getByTestId('GSEAAnalysis')).toBeInTheDocument();
    expect(window.location.search).toBe('?view=comprendre&panel=enrichment');
    expect(window.location.hash).toBe('#gsea');
  });
});

describe('add-on gating', () => {
  const NO_ADD_ON = {
    has_drug_discovery_module: false,
    has_scientific_module: false,
    has_cosmetics_module: false,
  };

  it('renders no tab and no section for a locked add-on', () => {
    renderDetail({ search: 'view=appliquer', profile: NO_ADD_ON });

    expect(renderedSections()).toEqual([]);
    expect(screen.queryByTestId('module-tabs')).toBeNull();
  });

  // Apply without any add-on used to be a hub over a folded one-line disclosure: a blank screen.
  it('unfolds the module list on a screen with nothing to open, and says why', () => {
    renderDetail({ search: 'view=appliquer', profile: NO_ADD_ON });

    expect(document.querySelector('details')).toHaveAttribute('open');
    expect(
      screen.getByText(/Nothing on this screen is open for this comparison yet/)
    ).toBeInTheDocument();
  });

  it('keeps admin access without the per-user flags', () => {
    renderDetail({ search: 'view=appliquer', profile: { role: 'ADMIN', ...NO_ADD_ON } });

    expect(tabNames()).toEqual(['Drug targets', 'Signature score', 'CosmOmics']);
  });

  // A locked module must stay visible as a capability, which is the disclosure's job — the old
  // behaviour removed its tab entirely and the feature became invisible.
  it('still lists a locked add-on, with a way to ask for it', () => {
    renderDetail({ search: 'view=appliquer', profile: { has_drug_discovery_module: false } });

    const disclosure = document.querySelector('details') as HTMLElement;
    expect(within(disclosure).getByText('Drug targets')).toBeInTheDocument();
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
    expect(renderedSections()).toEqual(['drug-discovery']);
  });

  it('writes the default screen bare', async () => {
    renderDetail({ search: 'view=partager' });

    await userEvent.click(screen.getByRole('button', { name: 'Open Explore' }));

    expect(window.location.search).toBe('');
  });

  // The open module belongs to the screen it was opened on.
  it('drops the open module when switching screen', async () => {
    renderDetail({ search: 'panel=methods' });

    await userEvent.click(screen.getByRole('button', { name: 'Open Understand' }));

    expect(window.location.search).toBe('?view=comprendre');
    expect(renderedSections()).toEqual(['ai']);
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

// The defect that shipped three times: replaceState never scrolls, so a card changed the address
// bar and left the page where it was. Opening a module from elsewhere brings its tab into view.
describe('opening a module', () => {
  it('opens the module of a card on the open screen, and scrolls to the tabs', async () => {
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Open Method statistics' }));

    expect(window.location.search).toBe('?panel=methods');
    expect(renderedSections()).toEqual(['methods']);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  // The Explore summary's jump into Understand is the one place a module opens another screen.
  it('crosses to another screen on the module asked for', async () => {
    renderDetail();
    expect(document.getElementById('enrichment')).toBeNull();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'open enrichment' }));

    expect(window.location.search).toBe('?view=comprendre&panel=enrichment');
    expect(window.location.hash).toBe('');
    expect(renderedSections()).toEqual(['enrichment']);
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

describe('Share → Exports', () => {
  const mockApi = api as jest.Mocked<typeof api>;

  // Two pages, so a single-request export (the old thousand-row reach) would lose a gene.
  const PAGES: Record<number, object[]> = {
    1: [
      { gene_id: 'ENSG01', gene_name: 'TP53', log_fc: 2.5, padj: 1e-8, regulation: 'UP' },
      { gene_id: 'ENSG02', gene_name: null, log_fc: -1.75, padj: 0.004, regulation: 'DOWN' },
    ],
    2: [{ gene_id: 'ENSG03', gene_name: 'MYC', log_fc: 1.2, padj: 0.03, regulation: 'UP' }],
  };

  let downloads: ReturnType<typeof captureDownloads>;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    downloads = captureDownloads();
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    mockApi.get.mockImplementation(((url: string, config?: { params?: { page?: number } }) => {
      if (url.includes('/deg-genes/')) {
        const page = config?.params?.page ?? 1;
        return Promise.resolve({
          data: {
            genes: PAGES[page] ?? [],
            pagination: { page, page_size: 1000, total: 3, total_pages: 2 },
          },
        });
      }
      // Nothing else on this screen is under test; leave it pending rather than invent a shape.
      return new Promise(() => {});
    }) as typeof api.get);
  });

  afterEach(() => {
    downloads.restore();
    alertSpy.mockRestore();
  });

  async function exportAs(label: 'Export CSV' | 'Export JSON') {
    const user = userEvent.setup();
    renderDetail({ search: 'view=partager' });
    const exportsSection = document.getElementById('exports') as HTMLElement;
    await user.click(within(exportsSection).getByRole('button', { name: /^export$/i }));
    await user.click(within(exportsSection).getByText(label));
    await waitFor(() => expect(downloads.count()).toBe(1));
    return (await downloads.files())[0];
  }

  it('downloads every DEG as CSV, across pages, with the documented columns', async () => {
    const file = await exportAs('Export CSV');

    expect(file.filename).toBe('KO_vs_WT_all_DEGs.csv');
    const [header, ...rows] = file.text.split('\n');
    expect(header).toBe('gene_id,gene_symbol,log2_fold_change,adjusted_p_value,regulation');
    expect(rows).toEqual([
      'ENSG01,TP53,2.5,1e-8,UP',
      'ENSG02,,-1.75,0.004,DOWN',
      'ENSG03,MYC,1.2,0.03,UP',
    ]);

    // Fetched on click, full pages, at the screen's thresholds.
    const degCalls = mockApi.get.mock.calls.filter(([url]) => String(url).includes('/deg-genes/'));
    expect(degCalls.map(([, config]) => (config as { params: { page: number } }).params.page)).toEqual([1, 2]);
    expect(degCalls[0][1]).toEqual(
      expect.objectContaining({
        params: expect.objectContaining({ page_size: 1000, padj_max: 0.05, logfc_min: 0.58 }),
      })
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('downloads the same rows as JSON, numbers kept as numbers', async () => {
    const file = await exportAs('Export JSON');

    expect(file.filename).toBe('KO_vs_WT_all_DEGs.json');
    expect(JSON.parse(file.text)).toEqual([
      { gene_id: 'ENSG01', gene_symbol: 'TP53', log2_fold_change: 2.5, adjusted_p_value: 1e-8, regulation: 'UP' },
      { gene_id: 'ENSG02', gene_symbol: '', log2_fold_change: -1.75, adjusted_p_value: 0.004, regulation: 'DOWN' },
      { gene_id: 'ENSG03', gene_symbol: 'MYC', log2_fold_change: 1.2, adjusted_p_value: 0.03, regulation: 'UP' },
    ]);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
