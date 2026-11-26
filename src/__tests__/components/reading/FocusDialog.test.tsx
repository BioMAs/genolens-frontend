/**
 * La vue agrandie : un cadre plein écran qui monte les modules EXISTANTS, tels quels.
 *
 * Les composants de module sont simulés (chacun rend un `data-testid` et ses propriétés en JSON) :
 * ce qu'on vérifie est le câblage — quel module pour quelle vue, avec quelles propriétés — et la
 * règle de verrou, pas le contenu des modules. Un module verrouillé ne doit pas même être monté :
 * `mockRendered` enregistre chaque rendu, et reste vide pour une vue verrouillée.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FocusDialog, {
  FOCUS_TITLES,
  FOCUS_VIEWS,
  type FocusContext,
} from '@/components/reading/FocusDialog';
import { LOCKED_COPY } from '@/components/reading/LockedPart';
import { FOCUS_KINDS, type FocusKind } from '@/components/reading/readingRoutes';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';
import { DEFAULT_THRESHOLDS } from '@/utils/volcano';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';
import { DEG_EXPORT_COLUMNS } from '@/hooks/useDegGenes';

const mockRendered: string[] = [];
let mockExportProps: Record<string, unknown> | null = null;
const mockFetchAllDegGenes = jest.fn();
const mockDownloadDegStats = jest.fn();
const mockRequest = jest.fn();

function mockStub(testId: string) {
  return function Stub(props: Record<string, unknown>) {
    mockRendered.push(testId);
    return <div data-testid={testId} data-props={JSON.stringify(props)} />;
  };
}

jest.mock('@/components/comparison/explorer/VolcanoPanel', () => ({
  __esModule: true,
  default: mockStub('volcano-panel'),
}));
jest.mock('@/components/comparison/explorer/ThresholdControl', () => ({
  __esModule: true,
  default: mockStub('threshold-control'),
}));
jest.mock('@/components/DEGTable', () => ({ __esModule: true, default: mockStub('deg-table') }));
jest.mock('@/components/ExportMenu', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRendered.push('export-menu');
    mockExportProps = props;
    return <div data-testid="export-menu" />;
  },
}));
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
jest.mock('@/components/GSEAAnalysis', () => ({
  __esModule: true,
  default: mockStub('gsea-analysis'),
}));
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

jest.mock('@/hooks/useDegGenes', () => ({
  ...jest.requireActual('@/hooks/useDegGenes'),
  fetchAllDegGenes: (...args: unknown[]) => mockFetchAllDegGenes(...args),
  downloadDegStats: (...args: unknown[]) => mockDownloadDegStats(...args),
}));

let mockRequested: string[] = [];
jest.mock('@/hooks/useModuleAccessRequest', () => ({
  useModuleAccessRequest: () => ({
    request: mockRequest,
    reset: jest.fn(),
    pending: null,
    notice: null,
    requested: mockRequested,
  }),
}));

const dataset = (id: string, type: DatasetType, name: string): Dataset => ({
  id,
  project_id: 'p1',
  name,
  type,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const degDataset = dataset('deg-1', DatasetType.DEG, 'DEG');
const enrichmentDataset = dataset('enr-1', DatasetType.ENRICHMENT, 'Enrichment');
const matrixDataset = dataset('matrix-1', DatasetType.MATRIX, 'Matrix');

const project: Project = {
  id: 'p1',
  name: 'Project',
  owner_id: 'u1',
  species: 'Homo sapiens',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const withMatrix: FocusContext = {
  projectId: 'p1',
  project,
  degDataset,
  enrichmentDataset,
  matrixDataset,
  actualComparisonName: 'KO_vs_WT',
  samples: {
    sampleIds: ['s1', 's2', 's3', 's4'],
    conditionMap: { s1: 'KO', s2: 'KO', s3: 'WT', s4: 'WT' },
    conditions: { left: 'KO', right: 'WT' },
  },
  sampleConditionMap: { s1: 'KO', s2: 'KO', s3: 'WT', s4: 'WT' },
  geneMap: { genes: ['G1', 'G2'], nameByGene: { G1: 'TP53', G2: 'MYC' } },
};

const withoutMatrix: FocusContext = {
  ...withMatrix,
  matrixDataset: undefined,
  samples: { sampleIds: [], conditionMap: {}, conditions: null },
  sampleConditionMap: {},
  geneMap: { genes: [], nameByGene: {} },
};

const allAccess: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

const noAccess: ModuleAccess = {
  skin: false,
  targets: false,
  science: false,
  report: false,
  ai: false,
  loaded: true,
};

/** Every focus view and the module it mounts, in the order of `FOCUS_KINDS`. */
const FOCUS_KIND_COMPONENTS: ReadonlyArray<readonly [FocusKind, string]> = [
  ['volcano', 'volcano-panel'],
  ['table', 'deg-table'],
  ['heatmap', 'heatmap-section'],
  ['methods', 'method-stats-panel'],
  ['lookup', 'string-enrichment-panel'],
  ['charts', 'custom-visualization-panel'],
  ['processes', 'go-enrichment-analysis'],
  ['gsea', 'gsea-analysis'],
  ['network', 'ppi-network-section'],
  ['targets', 'drug-discovery-panel'],
  ['claims', 'cosmomics-panel'],
  ['signature', 'signature-score-panel'],
];

function renderFocus({
  kind,
  access = allAccess,
  context = withMatrix,
  onClose = jest.fn(),
}: {
  kind: FocusKind | null;
  access?: ModuleAccess;
  context?: FocusContext;
  onClose?: () => void;
}) {
  return render(
    <ComparisonSelectionProvider>
      <FocusDialog kind={kind} context={context} access={access} onClose={onClose} />
    </ComparisonSelectionProvider>
  );
}

/** The properties a stubbed module was mounted with. */
const propsOf = (testId: string): Record<string, unknown> =>
  JSON.parse(screen.getByTestId(testId).getAttribute('data-props') ?? '{}');

beforeEach(() => {
  mockRendered.length = 0;
  mockExportProps = null;
  mockRequested = [];
  mockRequest.mockReset();
  mockFetchAllDegGenes.mockReset();
  mockDownloadDegStats.mockReset();
});

describe('FocusDialog — the table of views', () => {
  it('covers every focus kind, once', () => {
    expect(FOCUS_KIND_COMPONENTS.map(([kind]) => kind).sort()).toEqual([...FOCUS_KINDS].sort());
    expect(Object.keys(FOCUS_VIEWS).sort()).toEqual([...FOCUS_KINDS].sort());
  });

  it.each(FOCUS_KIND_COMPONENTS)('mounts the module for %s', (kind, testId) => {
    renderFocus({ kind, access: allAccess, context: withMatrix });
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('puts the threshold control above the volcano', () => {
    renderFocus({ kind: 'volcano' });
    const control = screen.getByTestId('threshold-control');
    const volcano = screen.getByTestId('volcano-panel');
    expect(control.compareDocumentPosition(volcano) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts an export menu beside the gene table', () => {
    renderFocus({ kind: 'table' });
    expect(screen.getByTestId('deg-table')).toBeInTheDocument();
    expect(screen.getByTestId('export-menu')).toBeInTheDocument();
  });
});

describe('FocusDialog — the frame', () => {
  it('renders nothing without a kind', () => {
    renderFocus({ kind: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockRendered).toEqual([]);
  });

  it('is a full-screen dialog', () => {
    renderFocus({ kind: 'volcano' });
    expect(screen.getByRole('dialog')).toHaveClass('h-[calc(100dvh-2rem)]', 'max-w-none');
  });

  it('names the view and the comparison in its title', () => {
    renderFocus({ kind: 'volcano' });
    expect(screen.getByRole('dialog', { name: 'Volcano, KO_vs_WT' })).toBeInTheDocument();
  });

  it('has the title of each view', () => {
    expect(FOCUS_TITLES).toEqual({
      volcano: 'Volcano',
      table: 'Genes',
      heatmap: 'Heatmap',
      methods: 'Methods',
      lookup: 'Database lookup',
      charts: 'Charts',
      processes: 'Processes',
      gsea: 'GSEA',
      network: 'Interaction network',
      targets: 'Drug targets',
      claims: 'Skin claims',
      signature: 'Signature score',
    });
  });

  it.each(FOCUS_KINDS)('titles the %s view with its name and the comparison', (kind) => {
    renderFocus({ kind });
    expect(
      screen.getByRole('dialog', { name: `${FOCUS_TITLES[kind]}, KO_vs_WT` })
    ).toBeInTheDocument();
  });

  it('closes on Escape and on the close button', async () => {
    const onClose = jest.fn();
    renderFocus({ kind: 'methods', onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('FocusDialog — locked views', () => {
  const LOCKED: ReadonlyArray<
    readonly [FocusKind, 'gsea' | 'signature' | 'targets' | 'claims', keyof ModuleAccess, string, string]
  > = [
    ['gsea', 'gsea', 'science', 'science', 'gsea-analysis'],
    ['signature', 'signature', 'science', 'science', 'signature-score-panel'],
    ['targets', 'targets', 'targets', 'drugdiscovery', 'drug-discovery-panel'],
    ['claims', 'claims', 'skin', 'claim', 'cosmomics-panel'],
  ];

  it('renders the locked block for gsea without the scientific module', () => {
    renderFocus({ kind: 'gsea', access: { ...allAccess, science: false } });
    expect(screen.queryByTestId('gsea-analysis')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask for access' })).toBeInTheDocument();
  });

  it.each(LOCKED)(
    'does not even mount the module of %s when its flag is off',
    (kind, copy, flag, _module, testId) => {
      renderFocus({ kind, access: { ...allAccess, [flag]: false } });
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      expect(mockRendered).toEqual([]);
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: LOCKED_COPY[copy].title })).toBeInTheDocument();
      expect(within(dialog).getByText(LOCKED_COPY[copy].body)).toBeInTheDocument();
    }
  );

  it.each(LOCKED)('asks for the right module from %s', async (kind, _copy, flag, module) => {
    renderFocus({ kind, access: { ...allAccess, [flag]: false } });
    await userEvent.click(screen.getByRole('button', { name: 'Ask for access' }));
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(module);
  });

  it.each(LOCKED)('opens %s on its own flag alone', (kind, _copy, flag, _module, testId) => {
    renderFocus({ kind, access: { ...noAccess, [flag]: true } });
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask for access' })).not.toBeInTheDocument();
  });

  it('asks for a module once', async () => {
    mockRequested = ['claim'];
    renderFocus({ kind: 'claims', access: { ...allAccess, skin: false } });
    const button = screen.getByRole('button', { name: 'Ask for access' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('shows the lock, not the matrix message, when both are missing', () => {
    renderFocus({
      kind: 'signature',
      access: { ...allAccess, science: false },
      context: withoutMatrix,
    });
    expect(screen.getByRole('button', { name: 'Ask for access' })).toBeInTheDocument();
    expect(screen.queryByText(/requires an expression matrix/)).not.toBeInTheDocument();
  });

  it.each(LOCKED)(
    'shows neither the lock nor the module of %s until the profile has arrived',
    (kind, _copy, _flag, _module, testId) => {
      renderFocus({ kind, access: { ...noAccess, loaded: false } });
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ask for access' })).not.toBeInTheDocument();
      expect(mockRendered).toEqual([]);
      expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    }
  );

  it('does not wait for the profile to open a view no module gates', () => {
    renderFocus({ kind: 'methods', access: { ...noAccess, loaded: false } });
    expect(screen.getByTestId('method-stats-panel')).toBeInTheDocument();
  });

  it('does not lock the views no module gates', () => {
    renderFocus({ kind: 'volcano', access: noAccess });
    expect(screen.getByTestId('volcano-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask for access' })).not.toBeInTheDocument();
  });
});

describe('FocusDialog — views that need the count matrix', () => {
  const NEEDS_MATRIX: ReadonlyArray<readonly [FocusKind, string, string]> = [
    ['heatmap', 'heatmap-section', 'Clustering'],
    ['charts', 'custom-visualization-panel', 'Free-form charts'],
    ['signature', 'signature-score-panel', 'Signature scoring'],
  ];

  it('says a count matrix is needed for the heatmap', () => {
    renderFocus({ kind: 'heatmap', access: allAccess, context: withoutMatrix });
    expect(screen.queryByTestId('heatmap-section')).not.toBeInTheDocument();
  });

  it.each(NEEDS_MATRIX)('says so for %s, and does not mount the module', (kind, testId, purpose) => {
    renderFocus({ kind, access: allAccess, context: withoutMatrix });
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    expect(mockRendered).toEqual([]);
    expect(screen.getByRole('heading', { name: 'No expression matrix' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^${purpose} requires an expression matrix`))).toBeInTheDocument();
  });

  it.each(FOCUS_KINDS.filter((k) => !['heatmap', 'charts', 'signature'].includes(k)))(
    'still mounts %s without a matrix',
    (kind) => {
      renderFocus({ kind, access: allAccess, context: withoutMatrix });
      expect(screen.queryByRole('heading', { name: 'No expression matrix' })).not.toBeInTheDocument();
      expect(mockRendered.length).toBeGreaterThan(0);
    }
  );
});

describe('FocusDialog — the props each module gets', () => {
  it('gives the volcano, the methods and the table the DEG dataset and the stored comparison key', () => {
    renderFocus({ kind: 'volcano' });
    expect(propsOf('volcano-panel')).toEqual({ dataset: degDataset, comparisonName: 'KO_vs_WT' });
  });

  it('gives the methods panel the dataset id, as ComparisonDetail does', () => {
    renderFocus({ kind: 'methods' });
    expect(propsOf('method-stats-panel')).toEqual({ datasetId: 'deg-1', comparisonName: 'KO_vs_WT' });
  });

  it('gives the table the DEG dataset', () => {
    renderFocus({ kind: 'table' });
    expect(propsOf('deg-table')).toEqual({ dataset: degDataset, comparisonName: 'KO_vs_WT' });
  });

  it('gives the heatmap both datasets, the samples and their conditions', () => {
    renderFocus({ kind: 'heatmap' });
    expect(propsOf('heatmap-section')).toEqual({
      degDataset,
      matrixDataset,
      comparisonName: 'KO_vs_WT',
      sampleIds: ['s1', 's2', 's3', 's4'],
      sampleConditionMap: { s1: 'KO', s2: 'KO', s3: 'WT', s4: 'WT' },
    });
  });

  it('leaves the samples out when the comparison has none, rather than passing empty ones', () => {
    renderFocus({
      kind: 'heatmap',
      context: { ...withMatrix, samples: withoutMatrix.samples, sampleConditionMap: {} },
    });
    const props = propsOf('heatmap-section');
    expect(props).not.toHaveProperty('sampleIds');
    expect(props).not.toHaveProperty('sampleConditionMap');
  });

  it('gives the charts every gene of the matrix', () => {
    renderFocus({ kind: 'charts' });
    expect(propsOf('custom-visualization-panel')).toEqual({
      datasetId: 'deg-1',
      comparisonName: 'KO_vs_WT',
      allGenes: ['G1', 'G2'],
    });
  });

  it('gives the processes the enrichment dataset, when there is one', () => {
    renderFocus({ kind: 'processes' });
    expect(propsOf('go-enrichment-analysis')).toEqual({
      dataset: degDataset,
      enrichmentDataset,
      comparisonName: 'KO_vs_WT',
    });
  });

  it('gives GSEA the DEG dataset', () => {
    renderFocus({ kind: 'gsea' });
    expect(propsOf('gsea-analysis')).toEqual({ dataset: degDataset, comparisonName: 'KO_vs_WT' });
  });

  it('gives the network the gene names and the project species', () => {
    renderFocus({ kind: 'network' });
    expect(propsOf('ppi-network-section')).toEqual({
      dataset: degDataset,
      comparisonName: 'KO_vs_WT',
      geneNameMap: { G1: 'TP53', G2: 'MYC' },
      projectSpecies: 'Homo sapiens',
    });
  });

  it('gives the drug targets and the claims the DEG dataset id and the stored key', () => {
    renderFocus({ kind: 'targets' });
    expect(propsOf('drug-discovery-panel')).toEqual({ datasetId: 'deg-1', comparisonName: 'KO_vs_WT' });
  });

  it('gives CosmOmics the DEG dataset id and the stored key', () => {
    renderFocus({ kind: 'claims' });
    expect(propsOf('cosmomics-panel')).toEqual({ datasetId: 'deg-1', comparisonName: 'KO_vs_WT' });
  });

  it('gives the signature score the project, the matrix and the samples', () => {
    renderFocus({ kind: 'signature' });
    expect(propsOf('signature-score-panel')).toEqual({
      projectId: 'p1',
      matrixDatasetId: 'matrix-1',
      samples: ['s1', 's2', 's3', 's4'],
      sampleConditionMap: { s1: 'KO', s2: 'KO', s3: 'WT', s4: 'WT' },
    });
  });
});

describe('FocusDialog — the gene table export', () => {
  it('exports every DEG at the current thresholds, as CSV or JSON', async () => {
    mockFetchAllDegGenes.mockResolvedValue([
      { gene_id: 'G1', gene_name: 'TP53', log_fc: 2, padj: 0.001, regulation: 'up' },
    ]);
    renderFocus({ kind: 'table' });

    expect(mockExportProps).toMatchObject({
      filename: 'KO_vs_WT_all_DEGs',
      formats: ['csv', 'json'],
      csvColumns: DEG_EXPORT_COLUMNS,
    });

    const rows = await (mockExportProps?.fetchData as () => Promise<unknown[]>)();
    expect(mockFetchAllDegGenes).toHaveBeenCalledWith('deg-1', 'KO_vs_WT', DEFAULT_THRESHOLDS);
    expect(rows).toEqual([
      {
        gene_id: 'G1',
        gene_symbol: 'TP53',
        log2_fold_change: 2,
        adjusted_p_value: 0.001,
        regulation: 'up',
      },
    ]);
  });

  it('offers the per-method p-values CSV next to the export menu', () => {
    renderFocus({ kind: 'table' });
    const button = screen.getByRole('button', { name: 'Per-method p-values (.csv)' });
    expect(button).toBeInTheDocument();
    // Same group as the full-table export: both are ways to take the table away.
    expect(button.parentElement).toContainElement(screen.getByTestId('export-menu'));
  });

  it('downloads the per-method p-values of the stored comparison on click', async () => {
    renderFocus({ kind: 'table' });
    await userEvent.click(screen.getByRole('button', { name: 'Per-method p-values (.csv)' }));
    expect(mockDownloadDegStats).toHaveBeenCalledTimes(1);
    expect(mockDownloadDegStats).toHaveBeenCalledWith('deg-1', 'KO_vs_WT');
  });

  it('does not offer it in the other views', () => {
    renderFocus({ kind: 'volcano' });
    expect(screen.queryByRole('button', { name: 'Per-method p-values (.csv)' })).not.toBeInTheDocument();
  });

  it('states the thresholds the export uses', () => {
    renderFocus({ kind: 'table' });
    const note = screen.getByText(/at the current thresholds/);
    expect(note).toHaveTextContent(`padj ≤ ${DEFAULT_THRESHOLDS.padj}`);
    expect(note).toHaveTextContent(`|log2FC| ≥ ${DEFAULT_THRESHOLDS.logfc}`);
  });
});
