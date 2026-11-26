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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReadingPage, { LAST_READING_KEY } from '@/components/reading/ReadingPage';
import { formatCount } from '@/components/reading/answers';
import { partDomId, READING_PARTS } from '@/components/reading/readingRoutes';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useTopPathways } from '@/hooks/useTopPathways';
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

jest.mock('@/components/reading/ReadingHeader', () => ({
  __esModule: true,
  default: mockStub('reading-header'),
}));
jest.mock('@/components/comparison/explorer/GeneListDeepLink', () => ({
  __esModule: true,
  default: mockStub('gene-list-deep-link'),
}));
jest.mock('@/components/comparison/explorer/VolcanoPanel', () => ({
  __esModule: true,
  default: mockStub('volcano-panel'),
}));
jest.mock('@/components/comparison/explorer/ThresholdControl', () => ({
  __esModule: true,
  default: mockStub('threshold-control'),
}));
jest.mock('@/components/AIInterpretationPanel', () => ({
  __esModule: true,
  default: mockStub('ai-interpretation-panel'),
}));
jest.mock('@/components/DEGTable', () => ({ __esModule: true, default: mockStub('deg-table') }));
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

const volcano = (points: VolcanoPoint[] | null) =>
  ({
    data: points ? { points } : undefined,
    isLoading: points === null,
    isError: false,
  }) as unknown as ReturnType<typeof useVolcanoPoints>;

function renderReading({
  access = allAccess,
  points = fixturePoints,
  context = {},
  analysisId,
}: {
  access?: ModuleAccess;
  points?: VolcanoPoint[] | null;
  context?: Record<string, unknown>;
  analysisId?: string;
} = {}) {
  mockAccess.mockReturnValue(access);
  mockContext.mockReturnValue({ ...CONTEXT, ...context });
  jest.mocked(useVolcanoPoints).mockReturnValue(volcano(points));

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReadingPage projectId="p1" comparisonName="KO_vs_WT" analysisId={analysisId} />
    </QueryClientProvider>
  );
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
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  jest.mocked(useTopPathways).mockReturnValue({ pathways: [], isLoading: false, isError: false });
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

  it('brings the report button into view for an old Share link', () => {
    setLocation(`${PATH}?view=partager`);
    renderReading();
    expect(window.location.search).toBe('?report=1');
    expect(scrolled).toHaveLength(1);
    expect(within(scrolled[0] as HTMLElement).getByTestId('reading-header')).toBeInTheDocument();
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

    renderReading({ access: { ...allAccess, ai: false } });

    expect(screen.getByText('The barrier is reinforced.')).toBeInTheDocument();
    expect(screen.getByText('Barrier claim supported')).toBeInTheDocument();
    expect(jest.mocked(useSavedInterpretation)).toHaveBeenCalledWith('deg-1', 'KO_vs_WT', false);
    // La page et la partie Skin claims lisent la même requête : mêmes arguments, une seule entrée de cache.
    const novaCalls = jest.mocked(useCosmOmicsNova).mock.calls.map((c) => JSON.stringify(c));
    expect(new Set(novaCalls)).toEqual(new Set([JSON.stringify(['deg-1', 'KO_vs_WT', true])]));
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
