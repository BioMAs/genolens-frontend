/**
 * Les chapitres de la lecture : la coque, et les quatre chapitres qui ne dépendent d'aucun module
 * payant (comptes, gènes, processus, sens). Les applications, qui en dépendent, sont dans
 * `applications.test.tsx`.
 *
 * Les composants lourds (volcano, lecture IA) sont simulés, ainsi que les hooks qui lisent le
 * serveur : ce qu'on vérifie est ce que le chapitre montre de ce qu'il reçoit et ce qu'il fait d'un
 * clic. L'état partagé (gène regardé, voie regardée) est LUI réel : un `ComparisonSelectionProvider`
 * est monté, et un témoin le lit.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReadingChapter from '@/components/reading/ReadingChapter';
import CountsChapter from '@/components/reading/chapters/CountsChapter';
import GenesChapter from '@/components/reading/chapters/GenesChapter';
import ProcessesChapter from '@/components/reading/chapters/ProcessesChapter';
import MeaningChapter from '@/components/reading/chapters/MeaningChapter';
import {
  COUNTS_LOAD_FAILED,
  ENRICHMENT_LOAD_FAILED,
  NO_ENRICHMENT_FILE,
  NO_PROCESS_ENRICHED,
} from '@/components/reading/answers';
import { partDomId, type FocusKind } from '@/components/reading/readingRoutes';
import { useTopGenes } from '@/hooks/useTopGenes';
import { useTopPathways, type TopPathway } from '@/hooks/useTopPathways';
import {
  ComparisonSelectionProvider,
  useFocusedTerm,
  useSelection,
} from '@/contexts/ComparisonSelectionContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { VolcanoPoint, SignificanceSummary } from '@/utils/volcano';
import { DatasetStatus, DatasetType, type Dataset } from '@/types';

jest.mock('@/components/comparison/explorer/VolcanoPanel', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-testid="volcano-panel" data-props={JSON.stringify(props)} />
  ),
}));
jest.mock('@/components/AIInterpretationPanel', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-testid="ai-interpretation-panel" data-props={JSON.stringify(props)} />
  ),
}));
jest.mock('@/hooks/useTopGenes', () => ({ useTopGenes: jest.fn() }));
jest.mock('@/hooks/useTopPathways', () => ({ useTopPathways: jest.fn() }));

const mockUseTopGenes = jest.mocked(useTopGenes);
const mockUseTopPathways = jest.mocked(useTopPathways);

const degDataset: Dataset = {
  id: 'deg-1',
  project_id: 'p1',
  name: 'DEG',
  type: DatasetType.DEG,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const summary: SignificanceSummary = {
  up: 1284,
  down: 1102,
  ns: 16000,
  significant: 2386,
  // Volontairement différent de `tested` : « genes tested » ne doit jamais venir d'ici.
  total: 19455,
};

const point = (gene: string, x: number, padj: number): VolcanoPoint => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true,
});

const pathway = (
  name: string,
  padj: number,
  direction: TopPathway['direction'],
  over: Partial<TopPathway> = {}
): TopPathway => ({
  id: `GO:${name}`,
  name,
  padj,
  geneCount: 12,
  genes: ['G1', 'G2'],
  direction,
  ...over,
});

const allAccess: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

/** Lit l'état partagé que les chapitres écrivent. */
function Probe() {
  const { focusedGene, genes, source, label } = useSelection();
  const term = useFocusedTerm();
  // Pas un `<output>` : son rôle implicite est `status`, que les chapitres utilisent aussi.
  return (
    <div data-testid="probe">
      {JSON.stringify({ focusedGene, term, selection: { genes, source, label: label ?? null } })}
    </div>
  );
}
const probe = () => JSON.parse(screen.getByTestId('probe').textContent ?? '{}');

function renderIn(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        {ui}
        <Probe />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTopGenes.mockReturnValue({ up: [], down: [], isLoading: false, isError: false });
  mockUseTopPathways.mockReturnValue({ pathways: [], isLoading: false, isError: false });
});

describe('ReadingChapter', () => {
  it('is a section named by its h2, with the id the menu and the fragment point at', () => {
    renderIn(
      <ReadingChapter part="genes" number={2} title="Which genes matter most?">
        <p>figure</p>
      </ReadingChapter>
    );
    const section = screen.getByRole('region', { name: 'Which genes matter most?' });
    expect(section).toHaveAttribute('id', partDomId('genes'));
    expect(section.tagName).toBe('SECTION');
    expect(
      within(section).getByRole('heading', { level: 2, name: 'Which genes matter most?' })
    ).toBeInTheDocument();
    expect(within(section).getByText('figure')).toBeInTheDocument();
  });

  it('shows the question number, decoratively, and the action beside the title', () => {
    renderIn(
      <ReadingChapter
        part="counts"
        number={1}
        title="How many genes change?"
        action={<button type="button">Do it</button>}
      >
        <p>figure</p>
      </ReadingChapter>
    );
    expect(screen.getByText('1')).toHaveAttribute('aria-hidden', 'true');
    // Le numéro est décoratif : le nom de la région reste la question.
    expect(screen.getByRole('region', { name: 'How many genes change?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument();
  });

  it('gives two chapters two different heading ids', () => {
    renderIn(
      <>
        <ReadingChapter part="counts" number={1} title="First">
          <p>a</p>
        </ReadingChapter>
        <ReadingChapter part="genes" number={2} title="Second">
          <p>b</p>
        </ReadingChapter>
      </>
    );
    const ids = screen.getAllByRole('heading', { level: 2 }).map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Boolean)).toBe(true);
  });
});

describe('CountsChapter', () => {
  const renderCounts = (
    over: Partial<React.ComponentProps<typeof CountsChapter>> = {},
    onOpenFocus: (kind: FocusKind) => void = noop
  ) =>
    renderIn(
      <CountsChapter
        summary={summary}
        tested={20000}
        degDataset={degDataset}
        comparisonName="KO_vs_WT"
        onOpenFocus={onOpenFocus}
        {...over}
      />
    );

  it('is the first question, verbatim, as the chapter of the counts', () => {
    renderCounts();
    const section = screen.getByRole('region', { name: 'How many genes change?' });
    expect(section).toHaveAttribute('id', partDomId('counts'));
  });

  it('shows the up and the down counts as two big numbers, with thousands separators', () => {
    renderCounts();
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('1,102')).toBeInTheDocument();
    expect(screen.getByText(/genes up/)).toBeInTheDocument();
    expect(screen.getByText(/genes down/)).toBeInTheDocument();
  });

  it('colours the two numbers with the direction tokens, never red against green', () => {
    renderCounts();
    expect(screen.getByText('1,284').closest('[class*="text-up"]')).not.toBeNull();
    expect(screen.getByText('1,102').closest('[class*="text-down"]')).not.toBeNull();
  });

  it('states the genes tested from `tested`, never from the cloud size', () => {
    renderCounts();
    expect(screen.getByText(/20,000 genes tested/)).toBeInTheDocument();
    expect(screen.queryByText(/19,455/)).not.toBeInTheDocument();
  });

  it('drops the sentence when the number tested is unknown, rather than inventing one', () => {
    renderCounts({ tested: null });
    expect(screen.queryByText(/genes tested/)).not.toBeInTheDocument();
    expect(screen.queryByText(/19,455/)).not.toBeInTheDocument();
    expect(screen.getByText('1,284')).toBeInTheDocument();
  });

  it('shows a placeholder, not zeros, while the volcano is still being counted', () => {
    renderCounts({ summary: null });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('Counting genes…')).toBeInTheDocument();
    expect(screen.queryByText(/genes tested/)).not.toBeInTheDocument();
  });

  it('says the counts could not be loaded when the volcano read failed, not that it is counting', () => {
    renderCounts({ summary: null, failed: true });
    expect(screen.getByText(COUNTS_LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('Counting genes…')).not.toBeInTheDocument();
    expect(screen.queryByText(/genes tested/)).not.toBeInTheDocument();
  });

  it('mounts the existing volcano on the DEG dataset and the comparison', () => {
    renderCounts();
    const props = JSON.parse(screen.getByTestId('volcano-panel').getAttribute('data-props') ?? '{}');
    expect(props.dataset.id).toBe('deg-1');
    expect(props.comparisonName).toBe('KO_vs_WT');
  });
});

describe('GenesChapter', () => {
  const up = Array.from({ length: 8 }, (_, i) => point(`UP${i + 1}`, 4 - i * 0.25, 1e-9 * (i + 1)));
  const down = Array.from({ length: 8 }, (_, i) => point(`DN${i + 1}`, -3 + i * 0.25, 1e-8 * (i + 1)));

  const renderGenes = (onOpenFocus: (kind: FocusKind) => void = noop) =>
    renderIn(<GenesChapter datasetId="deg-1" comparisonName="KO_vs_WT" onOpenFocus={onOpenFocus} />);

  beforeEach(() => {
    mockUseTopGenes.mockReturnValue({ up, down, isLoading: false, isError: false });
  });

  it('is the second question, verbatim, and reads the top genes of its dataset and comparison', () => {
    renderGenes();
    expect(screen.getByRole('region', { name: 'Which genes matter most?' })).toHaveAttribute(
      'id',
      partDomId('genes')
    );
    expect(mockUseTopGenes).toHaveBeenCalledWith('deg-1', 'KO_vs_WT');
  });

  it('shows eight genes in each of the two tables, rising and falling', () => {
    renderGenes();
    const rising = screen.getByRole('table', { name: 'Rising most' });
    const falling = screen.getByRole('table', { name: 'Falling most' });
    // Un en-tête et huit lignes.
    expect(within(rising).getAllByRole('row')).toHaveLength(9);
    expect(within(falling).getAllByRole('row')).toHaveLength(9);
    expect(within(rising).getByRole('button', { name: 'UP1' })).toBeInTheDocument();
    expect(within(falling).getByRole('button', { name: 'DN8' })).toBeInTheDocument();
    expect(within(rising).queryByText('DN1')).not.toBeInTheDocument();
  });

  it('gives each gene its log2FC with a sign, and its adjusted p', () => {
    mockUseTopGenes.mockReturnValue({
      up: [point('IL6', 3.456, 1.234e-9), point('CXCL8', 2, 0.0123)],
      down: [point('KRT1', -2.5, 0)],
      isLoading: false,
      isError: false,
    });
    renderGenes();
    const rising = screen.getByRole('table', { name: 'Rising most' });
    const falling = screen.getByRole('table', { name: 'Falling most' });
    const il6 = within(rising).getByRole('row', { name: /IL6/ });
    expect(within(il6).getByText('+3.46')).toBeInTheDocument();
    expect(within(il6).getByText('1.2e-9')).toBeInTheDocument();
    expect(within(within(rising).getByRole('row', { name: /CXCL8/ })).getByText('0.012')).toBeInTheDocument();
    const krt1 = within(falling).getByRole('row', { name: /KRT1/ });
    expect(within(krt1).getByText('−2.50')).toBeInTheDocument();
    // Un padj arrondi à zéro par le serveur reste lisible.
    expect(within(krt1).getByText('0')).toBeInTheDocument();
  });

  it('makes each symbol a button that focuses the gene', async () => {
    renderGenes();
    expect(probe().focusedGene).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'UP3' }));
    expect(probe().focusedGene).toBe('UP3');
    await userEvent.click(screen.getByRole('button', { name: 'DN2' }));
    expect(probe().focusedGene).toBe('DN2');
  });

  // La fiche gène (lot 2) a pris ce clic : le gène devient la sélection et le gène regardé, et la
  // page monte la fiche d'après `focusedGene`. Aucune vue agrandie ne s'ouvre plus.
  it('selects the clicked gene, as a table pick, and gives it to the sheet without opening a view', async () => {
    const onOpenFocus = jest.fn();
    renderGenes(onOpenFocus);
    await userEvent.click(screen.getByRole('button', { name: 'UP3' }));
    expect(probe().selection).toEqual({ genes: ['UP3'], source: 'table', label: null });
    expect(probe().focusedGene).toBe('UP3');
    expect(onOpenFocus).not.toHaveBeenCalled();
  });

  it('says so when nothing passes the thresholds, instead of two empty tables', () => {
    mockUseTopGenes.mockReturnValue({ up: [], down: [], isLoading: false, isError: false });
    renderGenes();
    expect(screen.getByText('No gene passes the thresholds')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps the side that has genes when only one of them is empty', () => {
    mockUseTopGenes.mockReturnValue({ up, down: [], isLoading: false, isError: false });
    renderGenes();
    expect(screen.getByRole('table', { name: 'Rising most' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Falling most' })).not.toBeInTheDocument();
    expect(screen.getByText('No gene falls at these thresholds')).toBeInTheDocument();
  });

  it('shows a loading status while the volcano cloud is not there yet, not the empty message', () => {
    mockUseTopGenes.mockReturnValue({ up: [], down: [], isLoading: true, isError: false });
    renderGenes();
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('No gene passes the thresholds')).not.toBeInTheDocument();
  });

  it('says the counts could not be loaded when the volcano read failed, not that no gene passes', () => {
    mockUseTopGenes.mockReturnValue({ up: [], down: [], isLoading: false, isError: true });
    renderGenes();
    expect(screen.getByText(COUNTS_LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('No gene passes the thresholds')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});

describe('ProcessesChapter', () => {
  const pathways = [
    pathway('Inflammatory response', 1e-8, 'up', { genes: ['IL6', 'CXCL8'] }),
    pathway('Epidermis development', 1e-4, 'down', { genes: ['KRT1', 'LCE1A'] }),
    pathway('Wound healing', 1e-2, null),
  ];

  const renderProcesses = (
    over: Partial<React.ComponentProps<typeof ProcessesChapter>> = {},
    onOpenFocus: (kind: FocusKind) => void = noop
  ) =>
    renderIn(
      <ProcessesChapter
        enrichmentDatasetId="enr-1"
        comparisonName="KO_vs_WT"
        access={allAccess}
        onOpenFocus={onOpenFocus}
        {...over}
      />
    );

  beforeEach(() => {
    mockUseTopPathways.mockReturnValue({ pathways, isLoading: false, isError: false });
  });

  it('is the third question, verbatim, and reads the pathways of the enrichment dataset', () => {
    renderProcesses();
    expect(screen.getByRole('region', { name: 'Which processes move?' })).toHaveAttribute(
      'id',
      partDomId('processes')
    );
    expect(mockUseTopPathways).toHaveBeenCalledWith('enr-1', 'KO_vs_WT');
  });

  it('draws one bar per process, as long as its -log10 padj against the strongest', () => {
    renderProcesses();
    const bars = screen.getAllByTestId('process-bar');
    expect(bars).toHaveLength(3);
    // 8 / 8 = 100 %, 4 / 8 = 50 %, 2 / 8 = 25 %.
    expect(bars.map((b) => b.style.width)).toEqual(['100%', '50%', '25%']);
    expect(screen.getByRole('button', { name: /Inflammatory response/ })).toHaveTextContent('8.0');
  });

  it('colours the bars by direction with the up and down tokens, and neutral without a direction', () => {
    renderProcesses();
    const [first, second, third] = screen.getAllByTestId('process-bar');
    expect(first.className).toMatch(/bg-up/);
    expect(second.className).toMatch(/bg-down/);
    expect(third.className).not.toMatch(/bg-up|bg-down/);
  });

  it('says the direction in words too, not by colour alone', () => {
    renderProcesses();
    expect(screen.getByRole('button', { name: /Inflammatory response.*rises/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Epidermis development.*falls/ })).toBeInTheDocument();
  });

  it('keeps a bar plottable when the server rounded padj down to zero', () => {
    mockUseTopPathways.mockReturnValue({
      pathways: [pathway('Strongest', 0, 'up'), pathway('Weaker', 1e-15, 'down')],
      isLoading: false,
      isError: false,
    });
    renderProcesses();
    const widths = screen.getAllByTestId('process-bar').map((b) => parseFloat(b.style.width));
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBeGreaterThan(0);
    expect(widths[1]).toBeLessThan(100);
  });

  // R40 : la voie regardée porte le padj de la barre cliquée, la fiche l'imprime tel quel.
  it('focuses the process on a click, with its id, its name, its genes and its adjusted p', async () => {
    renderProcesses();
    expect(probe().term).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Epidermis development/ }));
    expect(probe().term).toEqual({
      id: 'GO:Epidermis development',
      name: 'Epidermis development',
      genes: ['KRT1', 'LCE1A'],
      padj: 1e-4,
    });
  });

  // La fiche processus (lot 2) a pris ce clic : la voie est regardée, la page monte sa fiche. Ses
  // gènes ne deviennent la sélection que par « Select these genes », dans la fiche.
  it('focuses the clicked process for the sheet, selects nothing and opens no view', async () => {
    const onOpenFocus = jest.fn();
    renderProcesses({}, onOpenFocus);
    await userEvent.click(screen.getByRole('button', { name: /Inflammatory response/ }));
    expect(probe().term).toEqual({
      id: 'GO:Inflammatory response',
      name: 'Inflammatory response',
      genes: ['IL6', 'CXCL8'],
      padj: 1e-8,
    });
    expect(probe().selection.genes).toEqual([]);
    expect(onOpenFocus).not.toHaveBeenCalled();
  });

  it('takes the sheet back from a gene in focus: one sheet at a time, and the gene wins over a term', async () => {
    mockUseTopGenes.mockReturnValue({ up: [point('UP3', 3, 1e-9)], down: [], isLoading: false, isError: false });
    renderIn(
      <>
        <GenesChapter datasetId="deg-1" comparisonName="KO_vs_WT" onOpenFocus={noop} />
        <ProcessesChapter
          enrichmentDatasetId="enr-1"
          comparisonName="KO_vs_WT"
          access={allAccess}
          onOpenFocus={noop}
        />
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: 'UP3' }));
    expect(probe().focusedGene).toBe('UP3');
    await userEvent.click(screen.getByRole('button', { name: /Inflammatory response/ }));
    expect(probe().focusedGene).toBeNull();
    expect(probe().term.name).toBe('Inflammatory response');
  });

  it('explains a missing enrichment file with the sentence of answer 3', () => {
    mockUseTopPathways.mockReturnValue({ pathways: null, isLoading: false, isError: false });
    renderProcesses();
    expect(screen.getByText(NO_ENRICHMENT_FILE)).toBeInTheDocument();
    expect(screen.getByText('No enrichment file for this comparison')).toBeInTheDocument();
    expect(screen.queryByTestId('process-bar')).not.toBeInTheDocument();
  });

  it('says the same when the comparison has no enrichment dataset at all', () => {
    mockUseTopPathways.mockReturnValue({ pathways: null, isLoading: false, isError: false });
    renderProcesses({ enrichmentDatasetId: undefined });
    expect(mockUseTopPathways).toHaveBeenCalledWith(undefined, 'KO_vs_WT');
    expect(screen.getByText(NO_ENRICHMENT_FILE)).toBeInTheDocument();
  });

  it('says no process is enriched, with the sentence of answer 3, when the list is empty', () => {
    mockUseTopPathways.mockReturnValue({ pathways: [], isLoading: false, isError: false });
    renderProcesses();
    expect(screen.getByText(NO_PROCESS_ENRICHED)).toBeInTheDocument();
    expect(screen.getByText('No process is enriched at these thresholds')).toBeInTheDocument();
  });

  it('does not take a failed read for a missing file', () => {
    mockUseTopPathways.mockReturnValue({ pathways: null, isLoading: false, isError: true });
    renderProcesses();
    expect(screen.getByText('Enrichment results could not be loaded.')).toBeInTheDocument();
    // La même phrase que la réponse 3 : une seule constante pour les deux.
    expect(screen.getByText(ENRICHMENT_LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText(NO_ENRICHMENT_FILE)).not.toBeInTheDocument();
  });

  it('shows a loading status while the pathways are coming, not the missing-file sentence', () => {
    mockUseTopPathways.mockReturnValue({ pathways: null, isLoading: true, isError: false });
    renderProcesses();
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText(NO_ENRICHMENT_FILE)).not.toBeInTheDocument();
  });
});

describe('MeaningChapter', () => {
  it('is the fourth question, verbatim, and mounts the AI panel as it is', () => {
    renderIn(<MeaningChapter datasetId="deg-1" comparisonName="KO_vs_WT" />);
    const section = screen.getByRole('region', { name: 'What does it mean biologically?' });
    expect(section).toHaveAttribute('id', partDomId('meaning'));
    const panel = within(section).getByTestId('ai-interpretation-panel');
    expect(JSON.parse(panel.getAttribute('data-props') ?? '{}')).toEqual({
      datasetId: 'deg-1',
      comparisonName: 'KO_vs_WT',
    });
  });

  it('has no action button: the reading is written on a click, inside the panel', () => {
    renderIn(<MeaningChapter datasetId="deg-1" comparisonName="KO_vs_WT" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('the actions open the focus views', () => {
  const up = [point('IL6', 3, 1e-9)];

  type Chapter = 'counts' | 'genes' | 'processes';

  const renderChapter = (
    chapter: Chapter,
    onOpenFocus: (kind: FocusKind) => void,
    access: ModuleAccess = allAccess
  ) => {
    mockUseTopGenes.mockReturnValue({ up, down: [], isLoading: false, isError: false });
    mockUseTopPathways.mockReturnValue({
      pathways: [pathway('Inflammatory response', 1e-8, 'up')],
      isLoading: false,
      isError: false,
    });
    switch (chapter) {
      case 'counts':
        return renderIn(
          <CountsChapter
            summary={summary}
            tested={20000}
            degDataset={degDataset}
            comparisonName="KO_vs_WT"
            onOpenFocus={onOpenFocus}
          />
        );
      case 'genes':
        return renderIn(
          <GenesChapter datasetId="deg-1" comparisonName="KO_vs_WT" onOpenFocus={onOpenFocus} />
        );
      default:
        return renderIn(
          <ProcessesChapter
            enrichmentDatasetId="enr-1"
            comparisonName="KO_vs_WT"
            access={access}
            onOpenFocus={onOpenFocus}
          />
        );
    }
  };

  // Chaque outil de l'ancienne page a une entrée visible : aucun n'est joignable par l'URL seule.
  it.each([
    ['counts', 'Open the volcano', 'volcano'],
    ['counts', 'Heatmap', 'heatmap'],
    ['counts', 'Method statistics', 'methods'],
    ['counts', 'Custom charts', 'charts'],
    ['counts', 'Database lookup', 'lookup'],
    ['genes', 'All genes', 'table'],
    ['genes', 'Interaction network', 'network'],
    ['processes', 'Every process', 'processes'],
    ['processes', 'GSEA', 'gsea'],
  ] as const)('the %s chapter: %s opens the %s focus', async (chapter, label, kind) => {
    const onOpenFocus = jest.fn();
    renderChapter(chapter, onOpenFocus);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(onOpenFocus).toHaveBeenCalledTimes(1);
    expect(onOpenFocus).toHaveBeenCalledWith(kind);
  });

  it.each([
    ['counts', 'How many genes change?', 'Open the volcano', 'More views of the counts', ['Heatmap', 'Method statistics', 'Custom charts', 'Database lookup']],
    ['genes', 'Which genes matter most?', 'All genes', 'More views of the genes', ['Interaction network']],
    ['processes', 'Which processes move?', 'Every process', 'More views of the processes', ['GSEA']],
  ] as const)(
    'the %s chapter keeps one primary action in its header and its other tools in a quiet row below',
    (chapter, title, primary, group, tools) => {
      renderChapter(chapter, noop);
      const section = screen.getByRole('region', { name: title });
      const header = section.querySelector('header') as HTMLElement;
      expect(within(header).getAllByRole('button').map((b) => b.textContent)).toEqual([primary]);
      const row = within(section).getByRole('group', { name: group });
      expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([...tools]);
      // Discrets : aucune bordure ni aplat, la seule action marquée reste celle de l'en-tête.
      for (const button of within(row).getAllByRole('button')) {
        expect(button.className).not.toMatch(/\bborder\b|bg-accent|bg-surface\b/);
      }
    }
  );

  it('puts the quiet row of the counts under the volcano', () => {
    renderChapter('counts', noop);
    const volcano = screen.getByTestId('volcano-panel');
    const row = screen.getByRole('group', { name: 'More views of the counts' });
    expect(volcano.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks GSEA with a lock when the plan does not include it, and still opens it', async () => {
    const onOpenFocus = jest.fn();
    renderChapter('processes', onOpenFocus, { ...allAccess, science: false });
    const gsea = screen.getByRole('button', { name: 'GSEA, not in your plan' });
    expect(gsea.querySelector('svg')).not.toBeNull();
    expect(within(gsea).getByText(', not in your plan')).toHaveClass('sr-only');
    // La vue agrandie montre le bloc verrouillé et le moyen de demander l'accès.
    await userEvent.click(gsea);
    expect(onOpenFocus).toHaveBeenCalledWith('gsea');
  });

  it('shows no lock on GSEA with the module, nor while the profile is loading', () => {
    renderChapter('processes', noop, allAccess);
    expect(screen.getByRole('button', { name: 'GSEA' }).querySelector('svg')).toBeNull();
    expect(screen.queryByText(/not in your plan/)).not.toBeInTheDocument();
  });

  it('shows no lock on GSEA before the profile is known', () => {
    renderChapter('processes', noop, { ...allAccess, science: false, loaded: false });
    expect(screen.getByRole('button', { name: 'GSEA' })).toBeInTheDocument();
    expect(screen.queryByText(/not in your plan/)).not.toBeInTheDocument();
  });

  it('keeps the actions when there is nothing to draw: the focus view says why', () => {
    mockUseTopGenes.mockReturnValue({ up: [], down: [], isLoading: false, isError: false });
    mockUseTopPathways.mockReturnValue({ pathways: null, isLoading: false, isError: false });
    renderIn(
      <>
        <GenesChapter datasetId="deg-1" comparisonName="KO_vs_WT" onOpenFocus={noop} />
        <ProcessesChapter
          enrichmentDatasetId={undefined}
          comparisonName="KO_vs_WT"
          access={allAccess}
          onOpenFocus={noop}
        />
      </>
    );
    for (const name of ['All genes', 'Interaction network', 'Every process', 'GSEA']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
