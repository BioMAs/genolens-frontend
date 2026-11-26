/**
 * La page de lecture : l'assemblage.
 *
 * Chaque pièce a ses tests (routes, menu, colonne vertébrale, chapitres, vue agrandie, en-tête) ;
 * ce qu'on vérifie ici est ce que seule la page fait : lire l'URL à l'arrivée et la réécrire dans
 * sa forme canonique, défiler jusqu'à la partie, ouvrir la vue agrandie et l'inscrire dans l'URL,
 * poser les verrous du menu, nourrir les cinq réponses depuis la bonne source, et retenir la
 * dernière lecture.
 *
 * Le nuage du volcano est simulé au niveau de `useVolcanoPoints` : les comptes, les gènes et les
 * seuils (lus dans l'URL par le vrai `ComparisonSelectionProvider`) sont donc calculés pour de
 * vrai. Les modules lourds et l'en-tête sont des témoins qui affichent leurs propriétés.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import ReadingPage, { LAST_READING_KEY } from '@/components/reading/ReadingPage';
import { formatCount } from '@/components/reading/answers';
import { FOCUS_TITLES } from '@/components/reading/FocusDialog';
import { FOCUS_KINDS, partDomId, READING_PARTS, type FocusKind } from '@/components/reading/readingRoutes';
import {
  useComparisonActions,
  usePendingGeneListId,
} from '@/contexts/ComparisonSelectionContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useGeneSearch } from '@/hooks/useGeneSearch';
import { useTopPathways, type TopPathway } from '@/hooks/useTopPathways';
import { useSavedInterpretation } from '@/hooks/useSavedInterpretation';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import api from '@/utils/api';
import {
  clampThresholds,
  deriveSignificance,
  type VolcanoPoint,
  type VolcanoThresholds,
} from '@/utils/volcano';
import type { CosmOmicsNovaData, NovaClaim } from '@/types/cosmomics';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';
import ComparisonPage from '@/app/projects/[id]/comparisons/[comparisonName]/page';
import AnalysisComparisonPage from '@/app/projects/[id]/analyses/[analysisId]/comparisons/[comparisonName]/page';

// ── l'URL est l'état ─────────────────────────────────────────────────────────────────
// Comme dans `ComparisonDetail.test` : `useSearchParams` lit l'URL vivante, et un
// `replaceState` patché prévient ses abonnés, ce que Next fait (>= 14.1) et que jsdom ne fait pas.
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
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
    useParams: () => ({}),
  };
});

jest.mock('@/utils/api');

// ── ce qui existe et qui peut le voir ────────────────────────────────────────────────
const mockContext = jest.fn();
jest.mock('@/components/comparison/useComparisonContext', () => ({
  useComparisonContext: (...args: unknown[]) => mockContext(...args),
}));

const mockAccess = jest.fn();
jest.mock('@/hooks/useModuleAccess', () => ({
  useModuleAccess: () => mockAccess(),
}));

jest.mock('@/hooks/useModuleAccessRequest', () => ({
  useModuleAccessRequest: () => ({
    request: jest.fn(),
    reset: jest.fn(),
    pending: null,
    notice: null,
    requested: [],
  }),
}));

// ── les données ──────────────────────────────────────────────────────────────────────
jest.mock('@/hooks/useVisualizations', () => ({
  ...jest.requireActual('@/hooks/useVisualizations'),
  useVolcanoPoints: jest.fn(),
}));
jest.mock('@/hooks/useTopPathways', () => ({
  ...jest.requireActual('@/hooks/useTopPathways'),
  useTopPathways: jest.fn(),
}));
jest.mock('@/hooks/useGeneSearch', () => ({ useGeneSearch: jest.fn() }));
jest.mock('@/hooks/useSavedInterpretation', () => ({
  ...jest.requireActual('@/hooks/useSavedInterpretation'),
  useSavedInterpretation: jest.fn(),
}));
jest.mock('@/hooks/useCosmOmicsNova', () => ({
  ...jest.requireActual('@/hooks/useCosmOmicsNova'),
  useCosmOmicsNova: jest.fn(),
}));

// ── témoins ──────────────────────────────────────────────────────────────────────────
function mockStub(testId: string) {
  return function Stub(props: Record<string, unknown>) {
    return <div data-testid={testId} data-props={JSON.stringify(props)} />;
  };
}

/** L'en-tête, réduit à ses propriétés et au bouton qui ouvre la mise en page du rapport. */
function MockReadingHeader(props: Record<string, unknown>) {
  return (
    <div data-testid="reading-header" data-props={JSON.stringify(props)}>
      <button type="button" onClick={props.onOpenReportLayout as () => void}>
        Report layout
      </button>
    </div>
  );
}

/** La liste qu'un lien `?geneList=` résout, ou `null` tant qu'elle n'est pas arrivée. */
let mockGeneList: { id: string; name: string; genes: string[] } | null = null;

/** Résout `?geneList=` comme le vrai composant, sans l'API : la liste est `mockGeneList`. */
function MockGeneListDeepLink(props: Record<string, unknown>) {
  const pending = usePendingGeneListId();
  const { selectGeneList } = useComparisonActions();
  useEffect(() => {
    if (pending && mockGeneList?.id === pending) {
      selectGeneList(mockGeneList.id, mockGeneList.name, mockGeneList.genes);
    }
  }, [pending, selectGeneList]);
  return <div data-testid="gene-list-deep-link" data-props={JSON.stringify(props)} />;
}

/**
 * Une vue agrandie où l'on peut pointer un gène, comme un point du volcano ou une ligne de la table :
 * le même appel `selectGenes` que ces modules font, sans leur dessin. Des déclarations de fonction,
 * hissées : les fabriques de `jest.mock` tournent avant les `const` du fichier.
 */
function MockPicker({
  testId,
  label,
  source,
  props,
}: {
  testId: string;
  label: string;
  source: 'volcano' | 'table';
  props: Record<string, unknown>;
}) {
  const { selectGenes } = useComparisonActions();
  return (
    <div data-testid={testId} data-props={JSON.stringify(props)}>
      <button type="button" onClick={() => selectGenes(['IL6'], source)}>
        {label}
      </button>
    </div>
  );
}
function MockVolcanoPanel(props: Record<string, unknown>) {
  return <MockPicker testId="volcano-panel" label="Pick IL6 on the volcano" source="volcano" props={props} />;
}
/**
 * La table des gènes : le clic simple (`selectGenes`) et le geste Maj/Cmd-clic (`toggleGene`), les
 * deux appels que `DEGTable` fait sur une ligne.
 */
function MockDegTable(props: Record<string, unknown>) {
  const { toggleGene } = useComparisonActions();
  return (
    <>
      <MockPicker testId="deg-table" label="Pick IL6 in the table" source="table" props={props} />
      <button type="button" onClick={() => toggleGene('IL6', 'table')}>
        Toggle IL6 in the table
      </button>
      <button type="button" onClick={() => toggleGene('KRT1', 'table')}>
        Toggle KRT1 in the table
      </button>
    </>
  );
}

jest.mock('@/components/reading/ReadingHeader', () => ({
  __esModule: true,
  default: MockReadingHeader,
}));
jest.mock('@/components/comparison/explorer/GeneListDeepLink', () => ({
  __esModule: true,
  default: MockGeneListDeepLink,
}));
jest.mock('@/components/comparison/explorer/SelectionCard', () => ({
  __esModule: true,
  default: mockStub('selection-card'),
}));
jest.mock('@/components/comparison/explorer/GeneDetailCard', () => ({
  __esModule: true,
  default: mockStub('gene-detail-card'),
}));
jest.mock('@/components/report/ReportCustomizationPanel', () => ({
  __esModule: true,
  default: mockStub('report-customization-panel'),
}));
jest.mock('@/components/comparison/explorer/VolcanoPanel', () => ({
  __esModule: true,
  default: MockVolcanoPanel,
}));
jest.mock('@/components/comparison/explorer/ThresholdControl', () => ({
  __esModule: true,
  default: mockStub('threshold-control'),
}));
jest.mock('@/components/AIInterpretationPanel', () => ({
  __esModule: true,
  default: mockStub('ai-interpretation-panel'),
}));
jest.mock('@/components/DEGTable', () => ({ __esModule: true, default: MockDegTable }));
jest.mock('@/components/ExportMenu', () => ({ __esModule: true, default: mockStub('export-menu') }));
jest.mock('@/components/comparison/explorer/HeatmapSection', () => ({
  __esModule: true,
  default: mockStub('heatmap-section'),
}));
jest.mock('@/components/MethodStatsPanel', () => ({
  __esModule: true,
  default: mockStub('method-stats-panel'),
}));
jest.mock('@/components/integrations/StringEnrichmentPanel', () => ({
  __esModule: true,
  default: mockStub('string-enrichment-panel'),
}));
jest.mock('@/components/CustomVisualizationPanel', () => ({
  __esModule: true,
  default: mockStub('custom-visualization-panel'),
}));
jest.mock('@/components/GOEnrichmentAnalysis', () => ({
  __esModule: true,
  default: mockStub('go-enrichment-analysis'),
}));
jest.mock('@/components/GSEAAnalysis', () => ({ __esModule: true, default: mockStub('gsea-analysis') }));
jest.mock('@/components/network/PPINetworkSection', () => ({
  __esModule: true,
  default: mockStub('ppi-network-section'),
}));
jest.mock('@/components/tools/dd/DrugDiscoveryComparisonPanel', () => ({
  __esModule: true,
  default: mockStub('drug-discovery-panel'),
}));
jest.mock('@/components/cosmomics/CosmOmicsPanel', () => ({
  __esModule: true,
  default: mockStub('cosmomics-panel'),
}));
jest.mock('@/components/SignatureScorePanel', () => ({
  __esModule: true,
  default: mockStub('signature-score-panel'),
}));
jest.mock('@/components/cosmomics/CosmOmicsNova', () => ({
  __esModule: true,
  default: mockStub('cosmomics-nova'),
}));
jest.mock('@/components/cosmomics/NovaClaimCard', () => ({
  __esModule: true,
  ...jest.requireActual('@/components/cosmomics/NovaClaimCard'),
  default: mockStub('claim-card'),
}));
jest.mock('@/components/cosmomics/NovaLegend', () => ({
  __esModule: true,
  default: mockStub('nova-legend'),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────────────
const PATH = '/projects/p1/comparisons/KO_vs_WT';

const dataset = (id: string, type: DatasetType, metadata: Record<string, unknown> = {}): Dataset => ({
  id,
  project_id: 'p1',
  name: id,
  type,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  dataset_metadata: metadata,
});

const TESTED = 20000;

const project: Project = {
  id: 'p1',
  name: 'Project',
  owner_id: 'u1',
  species: 'Homo sapiens',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const CONDITION_MAP = { s1: 'KO', s2: 'KO', s3: 'WT' };

const CONTEXT = {
  project,
  datasets: [],
  decodedName: 'KO_vs_WT',
  actualComparisonName: 'KO_vs_WT',
  // Le dénominateur connu de la métadonnée : la requête /stats n'est pas faite.
  degDataset: dataset('deg-1', DatasetType.DEG, { deg_tested: TESTED }),
  enrichmentDataset: dataset('enr-1', DatasetType.ENRICHMENT),
  matrixDataset: dataset('mtx-1', DatasetType.MATRIX),
  samples: {
    sampleIds: ['s1', 's2', 's3'],
    conditionMap: CONDITION_MAP,
    conditions: { left: 'KO', right: 'WT' },
  },
  geneMap: { genes: ['IL6'], nameByGene: { IL6: 'IL6' } },
  isLoading: false,
  isError: false,
};

const allAccess: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

const NOT_LOADED: ModuleAccess = {
  skin: false,
  targets: false,
  science: false,
  report: false,
  ai: false,
  loaded: false,
};

const point = (gene: string, x: number, padj: number): VolcanoPoint => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: false,
});

/**
 * Cinq gènes dont deux ne passent qu'à des seuils plus lâches que ceux de l'ingestion : compter
 * aux seuils de l'URL brute donne 2 et 2, aux seuils bornés 1 et 1.
 */
const fixturePoints: VolcanoPoint[] = [
  point('IL6', 2, 0.001),
  point('LOOSE_FC', 0.3, 0.01),
  point('LOOSE_P', -1, 0.2),
  point('KRT1', -2, 0.001),
  point('FLAT', 0.05, 0.9),
];

/** La réponse 1 telle que la colonne vertébrale l'écrit, à ces seuils. */
const countsAt = (thresholds: VolcanoThresholds) => {
  const { up, down } = deriveSignificance(fixturePoints, thresholds);
  return `${formatCount(up)} up and ${formatCount(down)} down, of ${formatCount(TESTED)} genes tested`;
};

const setLocation = (url: string) => window.history.replaceState(null, '', url);

const volcano = (points: VolcanoPoint[] | null, failed = false) =>
  ({
    data: points ? { points } : undefined,
    isLoading: points === null && !failed,
    isError: failed,
  }) as unknown as ReturnType<typeof useVolcanoPoints>;

function renderReading({
  access = allAccess,
  points = fixturePoints,
  volcanoFailed = false,
  context = {},
  analysisId,
}: {
  access?: ModuleAccess;
  points?: VolcanoPoint[] | null;
  volcanoFailed?: boolean;
  context?: Record<string, unknown>;
  analysisId?: string;
} = {}) {
  mockAccess.mockReturnValue(access);
  mockContext.mockReturnValue({ ...CONTEXT, ...context });
  jest.mocked(useVolcanoPoints).mockReturnValue(volcano(points, volcanoFailed));

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <ReadingPage projectId="p1" comparisonName="KO_vs_WT" analysisId={analysisId} />
    </QueryClientProvider>
  );
  const result = render(tree());
  /** Rend la page à nouveau, avec ce que les simulations rendent maintenant. */
  const refresh = () => result.rerender(tree());
  return { ...result, refresh };
}

const propsOf = (testId: string): Record<string, unknown> =>
  JSON.parse(screen.getByTestId(testId).getAttribute('data-props') ?? '{}');

const menu = () => screen.getByRole('navigation', { name: 'Parts of this result' });

/** Les éléments que `scrollIntoView` a fait défiler, dans l'ordre. */
let scrolled: Element[] = [];

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
  jest.mocked(api.get).mockReset();
  mockUrlListeners.clear();
  setLocation(PATH);
  window.localStorage.clear();
  mockGeneList = null;
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  jest.mocked(useTopPathways).mockReturnValue({ pathways: [], isLoading: false, isError: false });
  jest.mocked(useGeneSearch).mockReturnValue({
    data: { results: [], total: 0, query: '' },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useGeneSearch>);
  jest.mocked(useSavedInterpretation).mockReturnValue({ text: null, isLoading: false });
  jest
    .mocked(useCosmOmicsNova)
    .mockReturnValue({ data: undefined, isLoading: false, error: null } as unknown as ReturnType<
      typeof useCosmOmicsNova
    >);
});

describe('ReadingPage — the arrival URL', () => {
  it('lands on Processes with the GSEA focus for an old GSEA link', () => {
    setLocation(`${PATH}?view=comprendre&panel=enrichment#gsea`);
    renderReading({ access: allAccess });
    expect(window.location.search).toBe('?focus=gsea');
    expect(window.location.hash).toBe('#part-processes');
    expect(screen.getByRole('dialog', { name: /^GSEA, / })).toBeInTheDocument();
  });

  it('keeps ?padj and ?gene while upgrading the URL', () => {
    setLocation(`${PATH}?tab=deg&padj=0.01&gene=IL6`);
    renderReading({ access: allAccess });
    expect(window.location.search).toBe('?padj=0.01&gene=IL6');
    expect(window.location.hash).toBe('#part-counts');
  });

  it('keeps ?geneList and ?datasetId too, and drops the old screen parameters', () => {
    setLocation(`${PATH}?view=appliquer&panel=cosmomics&geneList=gl-1&datasetId=deg-1`);
    renderReading();
    expect(window.location.search).toBe('?geneList=gl-1&datasetId=deg-1');
    expect(window.location.hash).toBe('#part-skin');
  });

  it('scrolls to the part the URL names', () => {
    setLocation(`${PATH}?view=appliquer&panel=cosmomics`);
    renderReading();
    expect(scrolled).toEqual([document.getElementById(partDomId('skin'))]);
  });

  it('neither scrolls nor rewrites a URL that names nothing', () => {
    renderReading();
    expect(scrolled).toEqual([]);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(PATH);
  });

  it('opens the focus view a canonical link names, on its part', () => {
    setLocation(`${PATH}?focus=table#part-genes`);
    renderReading();
    expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();
    expect(scrolled).toEqual([document.getElementById(partDomId('genes'))]);
    expect(window.location.search).toBe('?focus=table');
    expect(window.location.hash).toBe('#part-genes');
  });

  it('opens the report layout editor for an old Share link', () => {
    setLocation(`${PATH}?view=partager`);
    renderReading();
    expect(window.location.search).toBe('?focus=report');
    const dialog = screen.getByRole('dialog', { name: 'Report layout, KO_vs_WT' });
    expect(within(dialog).getByTestId('report-customization-panel')).toBeInTheDocument();
  });

  it('opens the report layout editor for an old report tab, locked without the module', () => {
    setLocation(`${PATH}?panel=report`);
    renderReading({ access: { ...allAccess, report: false } });
    const dialog = screen.getByRole('dialog', { name: 'Report layout, KO_vs_WT' });
    expect(within(dialog).queryByTestId('report-customization-panel')).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: 'Report layout needs the reporting module' })
    ).toBeInTheDocument();
  });

  it('still brings the report button into view for ?report=1, then drops it from the URL', () => {
    setLocation(`${PATH}?padj=0.01&report=1`);
    renderReading();
    expect(window.location.search).toBe('?padj=0.01');
    expect(scrolled).toHaveLength(1);
    expect(within(scrolled[0] as HTMLElement).getByTestId('reading-header')).toBeInTheDocument();
  });
});

describe('ReadingPage — the arrival scroll survives late content', () => {
  it('lands on a low part again once the chapters above have loaded', () => {
    setLocation(`${PATH}#part-skin`);
    const { refresh } = renderReading({ points: null });
    const skin = document.getElementById(partDomId('skin'));
    expect(scrolled).toEqual([skin]);

    // Le volcano arrive : les comptes et les gènes prennent leur hauteur au-dessus de la partie.
    jest.mocked(useVolcanoPoints).mockReturnValue(volcano(fixturePoints));
    refresh();
    expect(scrolled).toEqual([skin, skin]);
  });

  it('lets go of the part as soon as the reader moves', () => {
    setLocation(`${PATH}#part-skin`);
    const { refresh } = renderReading({ points: null });
    expect(scrolled).toHaveLength(1);

    fireEvent.wheel(window);
    jest.mocked(useVolcanoPoints).mockReturnValue(volcano(fixturePoints));
    refresh();
    expect(scrolled).toHaveLength(1);
  });

  it('follows the layout as it grows, where the browser can watch it', () => {
    const callbacks: Array<() => void> = [];
    const original = (window as { ResizeObserver?: unknown }).ResizeObserver;
    (window as { ResizeObserver?: unknown }).ResizeObserver = class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    try {
      setLocation(`${PATH}#part-meaning`);
      renderReading();
      const meaning = document.getElementById(partDomId('meaning'));
      expect(scrolled).toEqual([meaning]);

      act(() => callbacks.forEach((callback) => callback()));
      expect(scrolled).toEqual([meaning, meaning]);

      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      act(() => callbacks.forEach((callback) => callback()));
      expect(scrolled).toHaveLength(2);
    } finally {
      (window as { ResizeObserver?: unknown }).ResizeObserver = original;
    }
  });

  it('does not scroll on late content when the URL named no part', () => {
    const { refresh } = renderReading({ points: null });
    jest.mocked(useVolcanoPoints).mockReturnValue(volcano(fixturePoints));
    refresh();
    expect(scrolled).toEqual([]);
  });
});

describe('ReadingPage — every tool has a way in', () => {
  /** Le bouton visible de la page qui ouvre chaque vue agrandie. */
  const WAY_IN: Record<FocusKind, string> = {
    volcano: 'Open the volcano',
    heatmap: 'Heatmap',
    methods: 'Method statistics',
    charts: 'Custom charts',
    lookup: 'Database lookup',
    table: 'All genes',
    network: 'Interaction network',
    processes: 'Every process',
    gsea: 'GSEA',
    targets: 'Rank targets',
    claims: 'Evidence table',
    signature: 'Score samples',
    report: 'Report layout',
  };

  it('lists a way in for every focus view', () => {
    expect(Object.keys(WAY_IN).sort()).toEqual([...FOCUS_KINDS].sort());
  });

  it.each(Object.entries(WAY_IN))('opens %s from the %s button of the page', async (kind, name) => {
    const user = userEvent.setup();
    renderReading();
    await user.click(screen.getByRole('button', { name }));
    expect(window.location.search).toBe(`?focus=${kind}`);
    expect(
      screen.getByRole('dialog', { name: `${FOCUS_TITLES[kind as FocusKind]}, KO_vs_WT` })
    ).toBeInTheDocument();
  });

  it('offers GSEA with a padlock when the plan does not include it, and opens the locked view', async () => {
    const user = userEvent.setup();
    renderReading({ access: { ...allAccess, science: false } });
    await user.click(screen.getByRole('button', { name: 'GSEA, not in your plan' }));
    const dialog = screen.getByRole('dialog', { name: 'GSEA, KO_vs_WT' });
    expect(within(dialog).getByRole('heading', { name: 'GSEA needs the scientific module' })).toBeInTheDocument();
  });
});

describe('ReadingPage — the selection', () => {
  /** Une liste enregistrée : son id a la forme que `readGeneListId` accepte. */
  const LIST_ID = '0a1b2c3d-0000-4000-8000-000000000001';


  it('opens the volcano once a ?geneList= link has selected its genes', () => {
    mockGeneList = { id: LIST_ID, name: 'Saved list', genes: ['IL6', 'KRT1'] };
    setLocation(`${PATH}?geneList=${LIST_ID}`);
    renderReading();
    expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('focus')).toBe('volcano');
    expect(new URLSearchParams(window.location.search).get('geneList')).toBe(LIST_ID);
  });

  it('waits for the list: nothing opens while it has not resolved', () => {
    setLocation(`${PATH}?geneList=${LIST_ID}`);
    renderReading();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves a focus view the link names in place', () => {
    mockGeneList = { id: LIST_ID, name: 'Saved list', genes: ['IL6'] };
    setLocation(`${PATH}?geneList=${LIST_ID}&focus=heatmap`);
    renderReading();
    expect(screen.getByRole('dialog', { name: 'Heatmap, KO_vs_WT' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Volcano, KO_vs_WT' })).not.toBeInTheDocument();
  });
});

describe('ReadingPage — the sheet', () => {
  const genesRegion = () => within(screen.getByRole('region', { name: 'Which genes matter most?' }));
  const processesRegion = () => within(screen.getByRole('region', { name: 'Which processes move?' }));

  const INFLAMMATION: TopPathway = {
    id: 'GO:0006954',
    name: 'Inflammatory response',
    padj: 1e-8,
    geneCount: 2,
    genes: ['IL6', 'KRT1'],
    direction: 'up',
  };
  const withProcess = () =>
    jest
      .mocked(useTopPathways)
      .mockReturnValue({ pathways: [INFLAMMATION], isLoading: false, isError: false });

  it('opens the gene sheet on a gene of the top genes, not the volcano', async () => {
    const user = userEvent.setup();
    renderReading();
    await user.click(genesRegion().getByRole('button', { name: 'IL6' }));
    const sheet = screen.getByRole('dialog', { name: 'IL6' });
    expect(within(sheet).getByTestId('gene-detail-card')).toBeInTheDocument();
    expect(propsOf('gene-detail-card')).toMatchObject({ gene: 'IL6', comparisonName: 'KO_vs_WT' });
    expect(window.location.search).not.toContain('focus=');
    expect(screen.queryByRole('dialog', { name: 'Volcano, KO_vs_WT' })).not.toBeInTheDocument();
  });

  it('opens on load for a ?gene= link, on that gene', () => {
    setLocation(`${PATH}?gene=IL6`);
    renderReading();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    expect(propsOf('gene-detail-card').gene).toBe('IL6');
  });

  // R42 : la carte des gènes arrive après la page ; le titre de la fiche passe de l'accession au
  // symbole, c'est le même gène, et le focus qu'on a mis ailleurs n'est pas repris.
  it('does not take the focus back when the symbol of its gene resolves late', () => {
    const accession = 'ENSG00000136244';
    setLocation(`${PATH}?gene=${accession}`);
    const { refresh } = renderReading({ context: { geneMap: { genes: [accession], nameByGene: {} } } });
    expect(screen.getByRole('dialog', { name: accession })).toHaveFocus();
    const elsewhere = screen.getByRole('button', { name: 'All genes' });
    elsewhere.focus();

    mockContext.mockReturnValue({
      ...CONTEXT,
      geneMap: { genes: [accession], nameByGene: { [accession]: 'IL6' } },
    });
    refresh();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
  });

  it('is not there without a gene or a process in focus', () => {
    renderReading();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape, hands the focus back to the gene that opened it, and drops ?gene=', async () => {
    const user = userEvent.setup();
    renderReading();
    const gene = genesRegion().getByRole('button', { name: 'IL6' });
    await user.click(gene);
    await waitFor(() => expect(window.location.search).toContain('gene=IL6'));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gene).toHaveFocus();
    await waitFor(() => expect(window.location.search).not.toContain('gene='));
  });

  it('reads the other comparisons of the project for the gene it shows', async () => {
    setLocation(`${PATH}?gene=IL6`);
    renderReading();
    expect(useGeneSearch).toHaveBeenCalledWith({
      query: 'IL6',
      projectId: 'p1',
      limit: 50,
      enabled: true,
    });
  });

  it('opens the process sheet on a bar of the processes, named after it', async () => {
    withProcess();
    const user = userEvent.setup();
    renderReading();
    await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
    const sheet = screen.getByRole('dialog', { name: 'Inflammatory response' });
    expect(within(sheet).getByText('GO:0006954')).toBeInTheDocument();
    expect(within(sheet).getByText('2 genes')).toBeInTheDocument();
    expect(window.location.search).not.toContain('focus=');
  });

  it('prints on the process sheet the FDR of the bar it was opened from', async () => {
    withProcess();
    const user = userEvent.setup();
    renderReading();
    await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
    const sheet = screen.getByRole('dialog', { name: 'Inflammatory response' });
    expect(within(sheet).getByText(/FDR/)).toHaveTextContent('FDR 1.0e-8');
  });

  it('swaps the process for a gene sheet when a gene of the process is clicked', async () => {
    withProcess();
    const user = userEvent.setup();
    renderReading();
    await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
    const sheet = screen.getByRole('dialog', { name: 'Inflammatory response' });
    await user.click(within(sheet).getByRole('button', { name: 'IL6' }));
    expect(screen.queryByRole('dialog', { name: 'Inflammatory response' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    // Une seule fiche à la fois, et le focus reste dans elle.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'IL6' })).toHaveFocus();
  });

  it('selects the genes of the process, closes the sheet and opens the volcano with them', async () => {
    withProcess();
    const user = userEvent.setup();
    renderReading();
    await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
    await user.click(screen.getByRole('button', { name: 'Select these genes' }));
    expect(screen.queryByRole('dialog', { name: 'Inflammatory response' })).not.toBeInTheDocument();
    expect(window.location.search).toContain('focus=volcano');
    const dialog = screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' });
    expect(within(dialog).getByTestId('selection-card')).toBeInTheDocument();
    // La sélection nommée d'après la voie : c'est elle que la carte multi-gènes décrit.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('closes the process sheet on Escape, and hands the focus back to the bar that opened it', async () => {
    withProcess();
    const user = userEvent.setup();
    renderReading();
    const bar = processesRegion().getByRole('button', { name: /Inflammatory response/ });
    await user.click(bar);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bar).toHaveFocus();
  });

  it('is modal above a focus view: the view stays, Escape closes the sheet first and the view next', async () => {
    const user = userEvent.setup();
    setLocation(`${PATH}?gene=IL6`);
    renderReading();
    // Non modale tant que rien n'est agrandi : la page reste atteignable.
    expect(screen.getByRole('dialog', { name: 'IL6' })).not.toHaveAttribute('aria-modal', 'true');

    await user.click(screen.getByRole('button', { name: 'All genes' }));
    expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();
    const sheet = screen.getByRole('dialog', { name: 'IL6' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // R37 : ⌘K sur un gène de la comparaison qu'on lit pousse le MÊME chemin avec `?gene=` ; Next garde
  // l'état de la page quand seule la requête change, le fournisseur ne relit donc pas l'URL. La
  // page suit la valeur de `?gene=` dans l'URL (la précédente est retenue dans une ref, jamais
  // comparée à l'état : l'écriture différée de l'URL rouvrirait une fiche que le lecteur vient de
  // fermer).
  describe('a ?gene= that changes while the page stays (⌘K on the comparison being read)', () => {
    it('opens the sheet of the gene the URL now names', () => {
      renderReading();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      act(() => setLocation(`${PATH}?gene=IL6`));
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
      expect(propsOf('gene-detail-card').gene).toBe('IL6');
    });

    it('swaps the sheet when the URL names another gene', () => {
      setLocation(`${PATH}?gene=IL6`);
      renderReading();
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
      act(() => setLocation(`${PATH}?gene=KRT1`));
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'KRT1' })).toBeInTheDocument();
      expect(propsOf('gene-detail-card').gene).toBe('KRT1');
    });

    it('does not reopen a sheet the reader closed when the URL is rewritten with the same gene', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?gene=IL6`);
      renderReading();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // L'écriture différée n'a pas encore retiré `?gene=` : une réécriture qui garde le même gène
      // (un seuil qui bouge) ne change pas la valeur de l'URL, la fiche ne revient pas.
      act(() => setLocation(`${PATH}?gene=IL6&padj=0.04`));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the sheet again for a gene named after the URL let go of the first one', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?gene=IL6`);
      renderReading();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(window.location.search).not.toContain('gene='));
      act(() => setLocation(`${PATH}?gene=IL6`));
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    });

    // L'écriture différée de l'URL met `?gene=` au gène regardé : ce n'est pas une navigation, et la
    // rejouer comme telle réduirait une sélection de plusieurs gènes au seul gène regardé.
    it('does not take the echo of its own URL write for a navigation', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table`);
      renderReading();
      await user.click(screen.getByRole('button', { name: 'Toggle IL6 in the table' }));
      await user.click(screen.getByRole('button', { name: 'Toggle KRT1 in the table' }));
      await waitFor(() => expect(window.location.search).toContain('gene=KRT1'));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // Deux gènes sélectionnés : aucune fiche, ni avant l'écho ni après.
      expect(screen.queryByRole('dialog', { name: /^(IL6|KRT1)$/ })).not.toBeInTheDocument();
    });
  });

  // R39 : « Select these genes » ferme la fiche, qui lâche la voie regardée, puis le volcano se ferme :
  // la voie ne survit que comme la sélection nommée d'après elle. La vue du score de signature
  // doit y puiser, sinon le chemin « voie → score de signature » de la lecture précédente est perdu.
  describe('from a process to the signature score', () => {
    const selectProcessThenCloseVolcano = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
      await user.click(screen.getByRole('button', { name: 'Select these genes' }));
      expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    };

    it('seeds the signature view with the genes of the process that was selected, once the volcano is closed', async () => {
      withProcess();
      const user = userEvent.setup();
      renderReading();
      await selectProcessThenCloseVolcano(user);
      await user.click(screen.getByRole('button', { name: 'Score samples' }));
      const view = screen.getByRole('dialog', { name: 'Signature score, KO_vs_WT' });
      expect(within(view).getByTestId('signature-score-panel')).toBeInTheDocument();
      expect(propsOf('signature-score-panel')).toMatchObject({
        initialGenes: ['IL6', 'KRT1'],
        initialLabel: 'Inflammatory response',
      });
    });

    it('seeds nothing from a selection that did not come from a process', async () => {
      const user = userEvent.setup();
      renderReading();
      await user.click(genesRegion().getByRole('button', { name: 'IL6' }));
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: 'Score samples' }));
      const props = propsOf('signature-score-panel');
      expect(props.initialGenes).toBeUndefined();
      expect(props.initialLabel).toBeUndefined();
    });

    it('still seeds it from the process in focus when its sheet is open under the view', async () => {
      withProcess();
      const user = userEvent.setup();
      renderReading();
      await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
      await user.click(screen.getByRole('button', { name: 'Score samples' }));
      expect(propsOf('signature-score-panel')).toMatchObject({
        initialGenes: ['IL6', 'KRT1'],
        initialLabel: 'Inflammatory response',
      });
    });
  });

  // R41 (étend R31) : la fiche d'un gène ne s'ouvre que pour un gène seul. Maj/Cmd-clic construit une
  // sélection : à chaque gène ajouté, une fiche modale et son voile couvriraient la table.
  describe('building a selection with the toggle gesture', () => {
    it('opens the sheet for the first gene, then none once the selection holds two', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table`);
      renderReading();
      await user.click(screen.getByRole('button', { name: 'Toggle IL6 in the table' }));
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Toggle KRT1 in the table' }));
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'KRT1' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();
    });

    it('opens no sheet for a gene added after the first one was closed', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table`);
      renderReading();
      await user.click(screen.getByRole('button', { name: 'Toggle IL6 in the table' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
      // La sélection garde IL6 : en ajouter un autre en fait deux, et la fiche ne revient pas.
      await user.click(screen.getByRole('button', { name: 'Toggle KRT1 in the table' }));
      expect(screen.queryByRole('dialog', { name: /^(IL6|KRT1)$/ })).not.toBeInTheDocument();
    });

    it('still opens the sheet for a plain click on a gene, whatever was selected before', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table`);
      renderReading();
      await user.click(screen.getByRole('button', { name: 'Toggle IL6 in the table' }));
      await user.click(screen.getByRole('button', { name: 'Toggle KRT1 in the table' }));
      expect(screen.queryByRole('dialog', { name: /^(IL6|KRT1)$/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Pick IL6 in the table' }));
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    });
  });

  // R35 : l'ouverture d'une vue sous une fiche ouverte ne doit pas faire perdre le focus. La fermeture
  // de la fiche (cachée par le volcano) rendait le focus à la boîte fraîchement montée, qui retenait
  // alors son propre panneau comme point de retour : à la fermeture, le focus tombait sur le corps.
  it('gives the focus back to the button that opened the volcano, with a sheet open under it', async () => {
    const user = userEvent.setup();
    setLocation(`${PATH}?gene=IL6`);
    renderReading();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
    const opener = screen.getByRole('button', { name: 'Open the volcano' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  // R31 : la vue volcano a sa propre carte de sélection, la fiche ne la double pas.
  describe('over the volcano view', () => {
    const LIST_ID = '0a1b2c3d-0000-4000-8000-000000000001';

    it('opens no sheet for a gene picked while the volcano is open: its selection card shows it', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=volcano`);
      renderReading();
      // Le chapitre des comptes monte aussi un volcano : on pointe celui de la vue agrandie.
      const view = within(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' }));
      await user.click(view.getByRole('button', { name: 'Pick IL6 on the volcano' }));
      expect(view.getByTestId('selection-card')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });

    it('opens the sheet, modal on top, for the same pick in another view', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table`);
      renderReading();
      await user.click(screen.getByRole('button', { name: 'Pick IL6 in the table' }));
      expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'IL6' })).toHaveAttribute('aria-modal', 'true');
    });

    it('opens no sheet for a ?gene= link that names the volcano', () => {
      setLocation(`${PATH}?focus=volcano&gene=IL6`);
      renderReading();
      expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
    });

    // R34 : la vue volcano porte la fiche de ce qu'on y pointe ; la fermer lâche le gène (et la
    // voie) regardés, sinon la fiche surgirait à la fermeture. La sélection multi-gènes reste.
    it('does not pop the sheet open when the volcano closes after a pick', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=volcano`);
      renderReading();
      const view = within(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' }));
      await user.click(view.getByRole('button', { name: 'Pick IL6 on the volcano' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lets go of the gene of a ?gene= link when the volcano closes', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=volcano&gene=IL6`);
      renderReading();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(window.location.search).not.toContain('gene='));
    });

    it('lets go of the process in focus too, when the volcano opened over its sheet', async () => {
      withProcess();
      const user = userEvent.setup();
      renderReading();
      await user.click(processesRegion().getByRole('button', { name: /Inflammatory response/ }));
      expect(screen.getByRole('dialog', { name: 'Inflammatory response' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Open the volcano' }));
      expect(screen.queryByRole('dialog', { name: 'Inflammatory response' })).not.toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps a multi-gene selection when the volcano closes', async () => {
      mockGeneList = { id: LIST_ID, name: 'Saved list', genes: ['IL6', 'KRT1'] };
      setLocation(`${PATH}?geneList=${LIST_ID}`);
      const user = userEvent.setup();
      renderReading();
      expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // L'URL suit la sélection avec un délai : si la liste avait été lâchée, `geneList=` partirait.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(window.location.search).toContain(`geneList=${LIST_ID}`);
    });

    it('does not let go of the gene when another view closes', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?focus=table&gene=IL6`);
      renderReading();
      // La fiche modale se ferme d'abord, et lâche le gène : la vue, elle, reste.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' })).toBeInTheDocument();
    });

    it('hides a sheet that is open when the volcano opens over it', async () => {
      const user = userEvent.setup();
      setLocation(`${PATH}?gene=IL6`);
      renderReading();
      expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Open the volcano' }));
      expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
    });
  });
});

describe('ReadingPage — reprocessing', () => {
  it('reprocesses the DEG dataset from the methods view', async () => {
    jest.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    setLocation(`${PATH}?focus=methods`);
    renderReading();
    const dialog = within(screen.getByRole('dialog', { name: 'Methods, KO_vs_WT' }));
    await user.click(dialog.getByRole('button', { name: 'Reprocess DEG' }));
    expect(api.post).toHaveBeenCalledWith('/datasets/deg-1/reprocess');
    expect(dialog.getByRole('button', { name: 'Reprocessing…' })).toBeDisabled();
  });

  it('remembers the reprocessing when the methods view is closed and opened again', async () => {
    jest.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    setLocation(`${PATH}?focus=methods`);
    renderReading();
    await user.click(screen.getByRole('button', { name: 'Reprocess DEG' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Method statistics' }));
    expect(screen.getByRole('button', { name: 'Reprocessing…' })).toBeDisabled();
  });
});

describe('ReadingPage — focus views', () => {
  it('writes ?focus= when a figure is opened, and removes it on close, keeping the rest', async () => {
    const user = userEvent.setup();
    setLocation(`${PATH}?padj=0.01`);
    renderReading();

    await user.click(screen.getByRole('button', { name: 'Open the volcano' }));
    expect(window.location.search).toBe('?padj=0.01&focus=volcano');
    const dialog = screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' });
    expect(within(dialog).getByTestId('volcano-panel')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('?padj=0.01');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives the focus view the comparison, the stored key and the sample conditions', () => {
    setLocation(`${PATH}?focus=heatmap`);
    renderReading({ context: { decodedName: 'DEG Analysis KO vs WT', actualComparisonName: 'KO_vs_WT' } });
    expect(propsOf('heatmap-section')).toEqual({
      degDataset: CONTEXT.degDataset,
      matrixDataset: CONTEXT.matrixDataset,
      comparisonName: 'KO_vs_WT',
      sampleIds: ['s1', 's2', 's3'],
      sampleConditionMap: CONDITION_MAP,
    });
  });

  it('renders the focus view inside the page selection, at the thresholds of the URL', () => {
    setLocation(`${PATH}?padj=0.01&focus=table`);
    renderReading();
    const dialog = screen.getByRole('dialog', { name: 'Genes, KO_vs_WT' });
    expect(within(dialog).getByText(/padj < 0\.01/)).toBeInTheDocument();
  });
});

describe('ReadingPage — the menu', () => {
  it('locks the parts the plan does not include, once the profile is known', () => {
    renderReading({ access: { ...allAccess, targets: false, science: false } });
    const nav = within(menu());
    expect(nav.getByRole('link', { name: 'Drug targets, not in your plan' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Signature score, not in your plan' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Skin claims' })).toBeInTheDocument();
  });

  it('locks Skin claims without the CosmOmics module', () => {
    renderReading({ access: { ...allAccess, skin: false } });
    expect(
      within(menu()).getByRole('link', { name: 'Skin claims, not in your plan' })
    ).toBeInTheDocument();
  });

  it('shows no padlock while the profile loads', () => {
    renderReading({ access: NOT_LOADED });
    expect(within(menu()).queryByRole('link', { name: /not in your plan/ })).not.toBeInTheDocument();
  });

  it('links each part with an in-page anchor, from the menu and from the answers', () => {
    renderReading();
    expect(within(menu()).getByRole('link', { name: 'Top genes' })).toHaveAttribute('href', '#part-genes');
    const answers = screen.getByRole('region', { name: 'Answers' });
    expect(within(answers).getAllByRole('link')[0]).toHaveAttribute('href', '#part-counts');
  });

  it('has a section for every part it lists, so no link scrolls nowhere', () => {
    renderReading();
    const missing = READING_PARTS.filter((p) => !document.getElementById(partDomId(p.id))).map(
      (p) => p.id
    );
    expect(missing).toEqual([]);
  });

  it('places the menu in its own column beside the reading', () => {
    renderReading();
    const column = menu().parentElement as HTMLElement;
    const reading = screen.getByRole('region', { name: 'Answers' }).parentElement as HTMLElement;
    expect(column.parentElement).toBe(reading.parentElement);
    expect(column.parentElement?.className).toContain('min-[75rem]:grid');
  });
});

describe('ReadingPage — the answers', () => {
  it('answers at clamped thresholds for loose URL values', () => {
    setLocation(`${PATH}?padj=0.5&lfc=0.1`);
    renderReading({ access: allAccess, points: fixturePoints });
    expect(screen.getByText(countsAt(clampThresholds({ padj: 0.5, logfc: 0.1 })))).toBeInTheDocument();
    expect(screen.queryByText(countsAt({ padj: 0.5, logfc: 0.1 }))).not.toBeInTheDocument();
  });

  it('takes the genes tested from the dataset, never from the volcano cloud', () => {
    renderReading();
    expect(screen.getByText(/, of 20,000 genes tested$/)).toBeInTheDocument();
    expect(screen.queryByText(/of 5 genes tested/)).not.toBeInTheDocument();
  });

  it('asks the stats endpoint for the genes tested when the metadata does not have them', async () => {
    jest.mocked(api.get).mockResolvedValue({ data: { total_genes: 18000 } });
    renderReading({ context: { degDataset: dataset('deg-1', DatasetType.DEG) } });
    expect(await screen.findByText(/, of 18,000 genes tested$/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/datasets/deg-1/stats', { params: {} });
  });

  it('reads the genes tested of the comparison when the URL pins the dataset', () => {
    setLocation(`${PATH}?datasetId=deg-1`);
    renderReading({
      context: {
        degDataset: dataset('deg-1', DatasetType.DEG, {
          deg_tested: 1,
          comparisons: { KO_vs_WT: { deg_tested: 15000 } },
        }),
      },
    });
    expect(screen.getByText(/, of 15,000 genes tested$/)).toBeInTheDocument();
  });

  it('names the top genes, three rising and two falling', () => {
    renderReading({
      points: [
        point('UP1', 3, 0.0001),
        point('UP2', 3, 0.0002),
        point('UP3', 3, 0.0003),
        point('UP4', 3, 0.0004),
        point('DOWN1', -3, 0.0001),
        point('DOWN2', -3, 0.0002),
        point('DOWN3', -3, 0.0003),
      ],
    });
    expect(screen.getByText('UP1, UP2 and UP3 rise most; DOWN1 and DOWN2 fall most')).toBeInTheDocument();
  });

  it('reads the pathways of the enrichment dataset, under the stored key', () => {
    jest.mocked(useTopPathways).mockReturnValue({
      pathways: [
        { id: 'GO:1', name: 'Inflammatory response', padj: 0.001, geneCount: 4, genes: [], direction: 'up' },
        { id: 'GO:2', name: 'Keratinization', padj: 0.002, geneCount: 3, genes: [], direction: 'down' },
      ],
      isLoading: false,
      isError: false,
    });
    renderReading({ context: { decodedName: 'DEG Analysis KO vs WT' } });
    expect(screen.getByText('Inflammatory response rises; keratinization falls')).toBeInTheDocument();
    for (const call of jest.mocked(useTopPathways).mock.calls) {
      expect(call.slice(0, 2)).toEqual(['enr-1', 'KO_vs_WT']);
    }
  });

  it('reads the saved AI reading and the claims under the module flags, with one request each', () => {
    const claim: NovaClaim = {
      name: 'Barrier',
      importance: 1,
      s_pro: 2,
      s_anti: 0.5,
      coherence: 0.8,
      n_for: 3,
      n_against: 1,
      subgroups: [],
    };
    jest.mocked(useSavedInterpretation).mockReturnValue({
      text: '## Reading\n\nThe barrier is **reinforced**. Then more.',
      isLoading: false,
    });
    jest.mocked(useCosmOmicsNova).mockReturnValue({
      data: { claims: [claim], status: 'ok' } as unknown as CosmOmicsNovaData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCosmOmicsNova>);

    renderReading({ access: allAccess });

    expect(screen.getByText('The barrier is reinforced.')).toBeInTheDocument();
    expect(screen.getByText('Barrier claim supported')).toBeInTheDocument();
    expect(jest.mocked(useSavedInterpretation)).toHaveBeenCalledWith('deg-1', 'KO_vs_WT', true);
    // La page et la partie Skin claims lisent la même requête : mêmes arguments, une seule entrée de cache.
    const novaCalls = jest.mocked(useCosmOmicsNova).mock.calls.map((c) => JSON.stringify(c));
    expect(new Set(novaCalls)).toEqual(new Set([JSON.stringify(['deg-1', 'KO_vs_WT', true])]));
  });

  it('asks for no saved reading without the AI, and says it is not in the plan', () => {
    renderReading({ access: { ...allAccess, ai: false } });
    for (const call of jest.mocked(useSavedInterpretation).mock.calls) expect(call[2]).toBe(false);
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('The AI reading is not in your plan')).toBeInTheDocument();
  });

  it('waits for the saved reading and for the claims instead of stating an absence', () => {
    jest.mocked(useSavedInterpretation).mockReturnValue({ text: null, isLoading: true });
    jest
      .mocked(useCosmOmicsNova)
      .mockReturnValue({ data: undefined, isLoading: true, error: null } as unknown as ReturnType<
        typeof useCosmOmicsNova
      >);
    renderReading();
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('Loading the reading…')).toBeInTheDocument();
    expect(answers.getByText('Reading skin claims…')).toBeInTheDocument();
    expect(answers.queryByText(/^Not written yet/)).not.toBeInTheDocument();
    expect(answers.queryByText('No skin claim data for this comparison')).not.toBeInTheDocument();
  });

  it('says the gene counts could not be loaded when the volcano read fails, in answers and chapters', () => {
    renderReading({ points: null, volcanoFailed: true });
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    // Réponses 1 et 2.
    expect(answers.getAllByText('Gene counts could not be loaded.')).toHaveLength(2);
    expect(answers.queryByText('Counting genes…')).not.toBeInTheDocument();
    expect(answers.queryByText('Ranking genes…')).not.toBeInTheDocument();
    // Chapitres 1 et 2.
    const counts = within(screen.getByRole('region', { name: 'How many genes change?' }));
    const genes = within(screen.getByRole('region', { name: 'Which genes matter most?' }));
    expect(counts.getByText('Gene counts could not be loaded.')).toBeInTheDocument();
    expect(genes.getByText('Gene counts could not be loaded.')).toBeInTheDocument();
    expect(genes.queryByText('No gene passes the thresholds')).not.toBeInTheDocument();
  });

  it('asks for no claim without the CosmOmics module', () => {
    renderReading({ access: { ...allAccess, skin: false } });
    for (const call of jest.mocked(useCosmOmicsNova).mock.calls) expect(call[2]).toBe(false);
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('Skin claims need the CosmOmics module')).toBeInTheDocument();
  });

  it('waits instead of stating an absence while the data loads', () => {
    jest.mocked(useTopPathways).mockReturnValue({ pathways: null, isLoading: true, isError: false });
    renderReading({ points: null, access: NOT_LOADED });
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('Counting genes…')).toBeInTheDocument();
    expect(answers.getByText('Ranking genes…')).toBeInTheDocument();
    expect(answers.getByText('Ranking processes…')).toBeInTheDocument();
    expect(answers.getByText('Checking your modules…')).toBeInTheDocument();
    expect(answers.queryByText('No gene passes the thresholds')).not.toBeInTheDocument();
    expect(answers.queryByText('No enrichment file for this comparison')).not.toBeInTheDocument();
  });

  it('says the enrichment could not be loaded when its read fails, not that it is still loading', () => {
    jest.mocked(useTopPathways).mockReturnValue({ pathways: null, isLoading: false, isError: true });
    renderReading();
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('Enrichment results could not be loaded.')).toBeInTheDocument();
    expect(answers.queryByText('Ranking processes…')).not.toBeInTheDocument();
    expect(answers.queryByText('No enrichment file for this comparison')).not.toBeInTheDocument();
  });

  it('says there is no enrichment file only when there is none', () => {
    jest.mocked(useTopPathways).mockReturnValue({ pathways: null, isLoading: false, isError: false });
    renderReading({ context: { enrichmentDataset: undefined } });
    const answers = within(screen.getByRole('region', { name: 'Answers' }));
    expect(answers.getByText('No enrichment file for this comparison')).toBeInTheDocument();
  });
});

describe('ReadingPage — header and deep links', () => {
  it('gives the header the stored key, the analysis and the two conditions with their samples', () => {
    renderReading({
      analysisId: 'a1',
      context: { decodedName: 'DEG Analysis KO vs WT', actualComparisonName: 'KO_vs_WT' },
    });
    expect(propsOf('reading-header')).toEqual({
      projectId: 'p1',
      project,
      decodedName: 'DEG Analysis KO vs WT',
      actualComparisonName: 'KO_vs_WT',
      analysisId: 'a1',
      conditions: { a: 'KO', na: 2, b: 'WT', nb: 1 },
      access: allAccess,
      degDatasetId: 'deg-1',
    });
  });

  it('says nothing about the conditions when one side has no sample', () => {
    renderReading({
      context: {
        samples: {
          sampleIds: ['s1'],
          conditionMap: { s1: 'KO' },
          conditions: { left: 'KO', right: 'WT' },
        },
      },
    });
    expect(propsOf('reading-header').conditions).toBeNull();
  });

  it('mounts the gene-list deep link, so ?geneList= keeps selecting genes', () => {
    renderReading();
    expect(propsOf('gene-list-deep-link')).toEqual({ projectId: 'p1' });
  });

  it('resolves the comparison with the analysis and the pinned dataset', () => {
    setLocation(`${PATH}?datasetId=deg-9`);
    renderReading({ analysisId: 'a1' });
    expect(mockContext).toHaveBeenCalledWith({
      projectId: 'p1',
      comparisonName: 'KO_vs_WT',
      analysisId: 'a1',
      globalDatasetId: 'deg-9',
    });
  });
});

describe('ReadingPage — the last reading', () => {
  it('remembers the comparison read, under its stored key', () => {
    renderReading({ context: { decodedName: 'DEG Analysis KO vs WT', actualComparisonName: 'KO_vs_WT' } });
    const saved = JSON.parse(window.localStorage.getItem(LAST_READING_KEY) ?? 'null');
    expect(LAST_READING_KEY).toBe('gl-last-reading');
    expect(saved).toEqual({ projectId: 'p1', comparisonName: 'KO_vs_WT', at: expect.any(String) });
    expect(new Date(saved.at).toISOString()).toBe(saved.at);
  });

  it('remembers the analysis too, when the comparison is read inside one', () => {
    renderReading({ analysisId: 'a1' });
    const saved = JSON.parse(window.localStorage.getItem(LAST_READING_KEY) ?? 'null');
    expect(saved).toEqual({
      projectId: 'p1',
      comparisonName: 'KO_vs_WT',
      analysisId: 'a1',
      at: expect.any(String),
    });
  });

  it('still reads when the storage is blocked', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      renderReading();
      expect(setItem).toHaveBeenCalledWith(LAST_READING_KEY, expect.any(String));
      expect(screen.getByRole('region', { name: 'Answers' })).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('ReadingPage — states', () => {
  it('says it is loading while the comparison resolves', () => {
    renderReading({ context: { isLoading: true } });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Parts of this result' })).not.toBeInTheDocument();
  });

  it('says the comparison failed to load', () => {
    renderReading({ context: { isError: true } });
    expect(screen.getByText('Failed to load comparison details.')).toBeInTheDocument();
  });

  it('says the project was not found', () => {
    renderReading({ context: { project: undefined } });
    expect(screen.getByText('Project not found')).toBeInTheDocument();
  });

  it('says there is no DEG dataset, with a way back to the analysis', () => {
    renderReading({ analysisId: 'a1', context: { degDataset: undefined } });
    expect(
      screen.getByText('No Differential Expression (DEG) dataset found for this comparison.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Analysis/ })).toHaveAttribute(
      'href',
      '/projects/p1/analyses/a1'
    );
  });

  it('does not rewrite the URL before there is a reading to land on', () => {
    setLocation(`${PATH}?view=comprendre`);
    renderReading({ context: { isLoading: true } });
    expect(window.location.search).toBe('?view=comprendre');
  });
});

describe('the two comparison routes', () => {
  it('render the reading', async () => {
    const plain = await ComparisonPage({
      params: Promise.resolve({ id: 'p1', comparisonName: 'KO_vs_WT' }),
    });
    expect(plain.type).toBe(ReadingPage);
    expect(plain.props).toEqual({ projectId: 'p1', comparisonName: 'KO_vs_WT' });

    const inAnalysis = await AnalysisComparisonPage({
      params: Promise.resolve({ id: 'p1', analysisId: 'a1', comparisonName: 'KO_vs_WT' }),
    });
    expect(inAnalysis.type).toBe(ReadingPage);
    expect(inAnalysis.props).toEqual({ projectId: 'p1', analysisId: 'a1', comparisonName: 'KO_vs_WT' });
  });
});
