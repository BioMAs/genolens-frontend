/**
 * La fiche d'un processus : son identifiant, son FDR, le nombre de ses gènes, puis la table de ces
 * gènes avec le log2FC et le padj que le volcano de la comparaison leur donne.
 *
 * Le nuage du volcano et les voies du cache sont simulés. L'état partagé (sélection, gène regardé)
 * est LUI réel : un `ComparisonSelectionProvider` est monté, et un témoin le lit.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import ProcessSheet from '@/components/reading/ProcessSheet';
import type { FocusContext } from '@/components/reading/FocusDialog';
import {
  ComparisonSelectionProvider,
  useFocusedTerm,
  useSelection,
} from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useTopPathways, type TopPathway } from '@/hooks/useTopPathways';
import type { FocusedTerm } from '@/contexts/ComparisonSelectionContext';
import type { VolcanoPoint } from '@/utils/volcano';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';

jest.mock('@/hooks/useVisualizations', () => ({
  ...jest.requireActual('@/hooks/useVisualizations'),
  useVolcanoPoints: jest.fn(),
}));
jest.mock('@/hooks/useTopPathways', () => ({
  ...jest.requireActual('@/hooks/useTopPathways'),
  useTopPathways: jest.fn(),
}));

const dataset = (id: string, type: DatasetType): Dataset => ({
  id,
  project_id: 'p1',
  name: id,
  type,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const project: Project = {
  id: 'p1',
  name: 'Project',
  owner_id: 'u1',
  species: 'Homo sapiens',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const context: FocusContext = {
  projectId: 'p1',
  project,
  degDataset: dataset('deg-1', DatasetType.DEG),
  enrichmentDataset: dataset('enr-1', DatasetType.ENRICHMENT),
  matrixDataset: dataset('mtx-1', DatasetType.MATRIX),
  actualComparisonName: 'KO_vs_WT',
  samples: { sampleIds: [], conditionMap: {}, conditions: null },
  sampleConditionMap: {},
  geneMap: { genes: [], nameByGene: {} },
  reprocess: { reprocessing: false, error: null, start: jest.fn() },
};

const term: FocusedTerm = {
  id: 'GO:0006954',
  name: 'Inflammatory response',
  genes: ['CXCL8', 'IL6', 'TNF', 'MISSING'],
};

const point = (gene: string, x: number, padj: number): VolcanoPoint => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  is_significant: true,
});

const cloud = (points: VolcanoPoint[] | null, failed = false) =>
  jest.mocked(useVolcanoPoints).mockReturnValue({
    data: points ? { points } : undefined,
    isLoading: points === null && !failed,
    isError: failed,
  } as unknown as ReturnType<typeof useVolcanoPoints>);

const pathway = (over: Partial<TopPathway>): TopPathway => ({
  id: 'GO:0006954',
  name: 'Inflammatory response',
  padj: 3.2e-8,
  geneCount: 40,
  genes: [],
  direction: 'up',
  ...over,
});

/** Lit l'état partagé que la fiche écrit. */
function Probe() {
  const { focusedGene, genes, source, label } = useSelection();
  const focused = useFocusedTerm();
  return (
    <div data-testid="probe">
      {JSON.stringify({ focusedGene, term: focused, selection: { genes, source, label: label ?? null } })}
    </div>
  );
}
const probe = () => JSON.parse(screen.getByTestId('probe').textContent ?? '{}');

const POINTS = [
  point('IL6', 2.5, 1e-9),
  point('TNF', 1.2, 0.03),
  point('CXCL8', -1.8, 2e-5),
  point('NOT_IN_TERM', 3, 1e-12),
];

function renderSheet(
  over: { term?: FocusedTerm; onOpenFocus?: jest.Mock; onClose?: jest.Mock; context?: FocusContext } = {}
) {
  const onOpenFocus = over.onOpenFocus ?? jest.fn();
  const onClose = over.onClose ?? jest.fn();
  const wrap = (children: ReactNode) => (
    <ComparisonSelectionProvider>
      {children}
      <Probe />
    </ComparisonSelectionProvider>
  );
  render(
    wrap(
      <ProcessSheet
        term={over.term ?? term}
        context={over.context ?? context}
        onOpenFocus={onOpenFocus}
        onClose={onClose}
      />
    )
  );
  return { onOpenFocus, onClose };
}

const geneRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const rowGene = (row: HTMLElement) => within(row).getAllByRole('cell')[0].textContent;

beforeEach(() => {
  jest.clearAllMocks();
  cloud(POINTS);
  jest.mocked(useTopPathways).mockReturnValue({
    pathways: [pathway({})],
    isLoading: false,
    isError: false,
  });
});

describe('ProcessSheet — what the process is', () => {
  it('shows the identifier and the number of genes', () => {
    renderSheet();
    expect(screen.getByText('GO:0006954')).toBeInTheDocument();
    expect(screen.getByText('4 genes')).toBeInTheDocument();
  });

  it('says "1 gene" in the singular', () => {
    renderSheet({ term: { ...term, genes: ['IL6'] } });
    expect(screen.getByText('1 gene')).toBeInTheDocument();
  });

  it('reads the FDR of the process from the enriched pathways of the comparison', () => {
    renderSheet();
    expect(useTopPathways).toHaveBeenCalledWith('enr-1', 'KO_vs_WT');
    expect(screen.getByText(/FDR/)).toHaveTextContent('FDR 3.2e-8');
  });

  it('gives no FDR, and does not invent one, for a process the chapter does not rank', () => {
    jest.mocked(useTopPathways).mockReturnValue({
      pathways: [pathway({ id: 'GO:other' })],
      isLoading: false,
      isError: false,
    });
    renderSheet();
    expect(screen.queryByText(/FDR/)).not.toBeInTheDocument();
  });

  it('draws no id line for a process without an identifier', () => {
    renderSheet({ term: { ...term, id: '' } });
    expect(screen.queryByText('GO:0006954')).not.toBeInTheDocument();
  });
});

describe('ProcessSheet — its genes', () => {
  it('lists the genes with log2FC and adjusted p from the volcano, most significant first', () => {
    renderSheet();
    const rows = geneRows();
    expect(rows.map(rowGene)).toEqual(['IL6', 'CXCL8', 'TNF', 'MISSING']);
    expect(within(rows[0]).getByText('+2.50')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1.0e-9')).toBeInTheDocument();
    expect(within(rows[1]).getByText('−1.80')).toBeInTheDocument();
    expect(within(rows[2]).getByText('0.030')).toBeInTheDocument();
  });

  it('puts a gene that is not in the volcano last, with dashes, not zeros', () => {
    renderSheet();
    const last = geneRows()[3];
    expect(within(last).getAllByText('—')).toHaveLength(2);
  });

  it('reads the volcano of this comparison', () => {
    renderSheet();
    expect(useVolcanoPoints).toHaveBeenCalledWith('deg-1', 'KO_vs_WT');
  });

  it('joins on the symbol when the volcano is keyed by accession', () => {
    cloud([point('ENSG00000136244', 2.5, 1e-9)]);
    renderSheet({
      term: { ...term, genes: ['IL6'] },
      context: {
        ...context,
        geneMap: { genes: ['ENSG00000136244'], nameByGene: { ENSG00000136244: 'IL6' } },
      },
    });
    expect(within(geneRows()[0]).getByText('+2.50')).toBeInTheDocument();
  });

  it('says it is loading while the volcano is, and that it could not be read when it failed', () => {
    cloud(null);
    const { unmount } = render(
      <ComparisonSelectionProvider>
        <ProcessSheet term={term} context={context} onOpenFocus={jest.fn()} onClose={jest.fn()} />
      </ComparisonSelectionProvider>
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    unmount();

    cloud(null, true);
    renderSheet();
    expect(screen.getByText(/could not be read/)).toBeInTheDocument();
    // Les gènes restent listés : le nom est connu même quand les statistiques ne le sont pas.
    expect(geneRows()).toHaveLength(4);
  });

  it('says so when the process carries no gene list', () => {
    renderSheet({ term: { ...term, genes: [] } });
    expect(screen.getByText('This process lists no genes.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('ProcessSheet — what a click does', () => {
  it('opens the gene sheet on a gene: selected as a table pick, and the one in focus', async () => {
    renderSheet();
    await userEvent.click(within(geneRows()[0]).getByRole('button', { name: 'IL6' }));
    expect(probe().focusedGene).toBe('IL6');
    expect(probe().selection).toEqual({ genes: ['IL6'], source: 'table', label: null });
  });

  it('selects the key the volcano uses, not the symbol the process spells', async () => {
    cloud([point('ENSG00000136244', 2.5, 1e-9)]);
    renderSheet({
      term: { ...term, genes: ['IL6'] },
      context: {
        ...context,
        geneMap: { genes: ['ENSG00000136244'], nameByGene: { ENSG00000136244: 'IL6' } },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'IL6' }));
    expect(probe().focusedGene).toBe('ENSG00000136244');
  });

  it('selects the genes of the process, named after it, then closes and opens the volcano', async () => {
    const calls: string[] = [];
    const onClose = jest.fn(() => calls.push('close'));
    const onOpenFocus = jest.fn((kind: string) => calls.push(`open:${kind}`));
    renderSheet({ onClose, onOpenFocus });
    await userEvent.click(screen.getByRole('button', { name: 'Select these genes' }));
    expect(probe().selection).toEqual({
      genes: ['CXCL8', 'IL6', 'TNF', 'MISSING'],
      source: 'pathway',
      label: 'Inflammatory response',
    });
    expect(probe().focusedGene).toBeNull();
    expect(onOpenFocus).toHaveBeenCalledWith('volcano');
    expect(calls).toEqual(['close', 'open:volcano']);
  });

  it('has nothing to select, and says so, for a process without genes', () => {
    renderSheet({ term: { ...term, genes: [] } });
    expect(screen.getByRole('button', { name: 'Select these genes' })).toBeDisabled();
  });
});
