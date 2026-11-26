/**
 * La fiche d'un gène : la carte de détail que le volcano montre déjà, puis « Across this study »
 * (le gène dans les autres comparaisons du projet), puis les liens vers les bases.
 *
 * `GeneDetailCard` est simulée (elle a ses propres tests et ses propres hooks) : on vérifie ce
 * qu'on lui donne. `useGeneSearch` l'est aussi : ce qu'on vérifie est ce que la fiche garde de sa
 * réponse, et ce qu'elle en montre.
 */
import { render, screen, within } from '@testing-library/react';
import GeneSheet from '@/components/reading/GeneSheet';
import type { FocusContext } from '@/components/reading/FocusDialog';
import { useGeneSearch } from '@/hooks/useGeneSearch';
import type { GeneSearchResult } from '@/types/gene-search';
import { DatasetStatus, DatasetType, type Dataset, type Project } from '@/types';

jest.mock('@/components/comparison/explorer/GeneDetailCard', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-testid="gene-detail-card" data-props={JSON.stringify(props)} />
  ),
}));
jest.mock('@/hooks/useGeneSearch', () => ({ useGeneSearch: jest.fn() }));

const mockUseGeneSearch = jest.mocked(useGeneSearch);

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
  samples: {
    sampleIds: ['s1', 's2', 's3'],
    conditionMap: { s1: 'KO', s2: 'KO', s3: 'WT' },
    conditions: { left: 'KO', right: 'WT' },
  },
  sampleConditionMap: { s1: 'KO', s2: 'KO', s3: 'WT' },
  geneMap: { genes: ['ENSG1', 'IL6'], nameByGene: { ENSG1: 'TP53' } },
  reprocess: { reprocessing: false, error: null, start: jest.fn() },
};

const result = (over: Partial<GeneSearchResult>): GeneSearchResult => ({
  gene_id: 'IL6',
  gene_symbol: 'IL6',
  project_id: 'p1',
  project_name: 'Project',
  dataset_id: 'deg-1',
  analysis_id: null,
  analysis_name: null,
  comparison_name: 'KO_vs_WT',
  log_fc: 2,
  padj: 0.001,
  regulation: 'UP',
  exact: true,
  ...over,
});

const search = (results: GeneSearchResult[] | null, state: { error?: boolean } = {}) =>
  mockUseGeneSearch.mockReturnValue({
    data: results ? { results, total: results.length, query: 'IL6' } : undefined,
    isLoading: results === null && !state.error,
    isError: !!state.error,
  } as unknown as ReturnType<typeof useGeneSearch>);

const renderSheet = (symbol = 'IL6') =>
  render(<GeneSheet symbol={symbol} projectId="p1" context={context} />);

const across = () => screen.getByRole('region', { name: 'Across this study' });

beforeEach(() => {
  jest.clearAllMocks();
  search([]);
});

describe('GeneSheet — the detail card', () => {
  it('mounts the gene card the way the volcano view wires its selection card', () => {
    renderSheet('ENSG1');
    const props = JSON.parse(screen.getByTestId('gene-detail-card').getAttribute('data-props') ?? '{}');
    expect(props).toMatchObject({
      gene: 'ENSG1',
      symbol: 'TP53',
      comparisonName: 'KO_vs_WT',
      sampleIds: ['s1', 's2', 's3'],
      conditionBySample: { s1: 'KO', s2: 'KO', s3: 'WT' },
    });
    expect(props.dataset.id).toBe('deg-1');
    expect(props.matrixDataset.id).toBe('mtx-1');
    expect(props.enrichmentDataset.id).toBe('enr-1');
  });

  it('hands the card undefined, not empty lists, when the comparison has no samples', () => {
    render(
      <GeneSheet
        symbol="IL6"
        projectId="p1"
        context={{
          ...context,
          matrixDataset: undefined,
          samples: { sampleIds: [], conditionMap: {}, conditions: null },
          sampleConditionMap: {},
        }}
      />
    );
    const props = JSON.parse(screen.getByTestId('gene-detail-card').getAttribute('data-props') ?? '{}');
    expect(props.sampleIds).toBeUndefined();
    expect(props.conditionBySample).toBeUndefined();
  });
});

describe('GeneSheet — across this study', () => {
  it('asks the gene search for the gene, fifty results at most', () => {
    renderSheet('IL6');
    expect(mockUseGeneSearch).toHaveBeenCalledWith({ query: 'IL6', limit: 50, enabled: true });
  });

  it('keeps only the exact results of this project, one row per comparison', () => {
    search([
      result({ comparison_name: 'KO_vs_WT', log_fc: 2, padj: 0.001 }),
      result({ comparison_name: 'DRUG_vs_CTRL', log_fc: -1.5, padj: 0.02, regulation: 'DOWN' }),
      // Un autre projet : jamais dans cette lecture.
      result({ project_id: 'p2', comparison_name: 'OTHER_PROJECT', log_fc: 4 }),
      // Une correspondance partielle (IL6R, IL6ST) : pas ce gène.
      result({ gene_id: 'IL6R', gene_symbol: 'IL6R', comparison_name: 'PARTIAL', exact: false }),
    ]);
    renderSheet();
    const rows = within(across()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(across()).getByRole('link', { name: 'KO_vs_WT' })).toBeInTheDocument();
    expect(within(across()).getByRole('link', { name: 'DRUG_vs_CTRL' })).toBeInTheDocument();
    expect(within(across()).queryByText('OTHER_PROJECT')).not.toBeInTheDocument();
    expect(within(across()).queryByText('PARTIAL')).not.toBeInTheDocument();
  });

  it('links each comparison to its reading, with the gene in the URL', () => {
    search([
      result({ comparison_name: 'KO_vs_WT' }),
      result({ comparison_name: 'Drug 10µM vs control', dataset_id: 'deg-2' }),
    ]);
    renderSheet('IL6');
    expect(within(across()).getByRole('link', { name: 'KO_vs_WT' })).toHaveAttribute(
      'href',
      '/projects/p1/comparisons/KO_vs_WT?gene=IL6'
    );
    // Le nom est une étiquette libre : encodé dans le chemin, comme `readingHref` le fait.
    expect(within(across()).getByRole('link', { name: 'Drug 10µM vs control' })).toHaveAttribute(
      'href',
      `/projects/p1/comparisons/${encodeURIComponent('Drug 10µM vs control')}?gene=IL6`
    );
  });

  it('encodes a gene key that is not a plain symbol', () => {
    search([result({ gene_id: 'HLA-DRB1/2', comparison_name: 'KO_vs_WT' })]);
    renderSheet('HLA-DRB1/2');
    expect(within(across()).getByRole('link', { name: 'KO_vs_WT' })).toHaveAttribute(
      'href',
      '/projects/p1/comparisons/KO_vs_WT?gene=HLA-DRB1%2F2'
    );
  });

  it('writes the log2FC with its sign, the true minus included, and the adjusted p', () => {
    search([
      result({ comparison_name: 'A_up', log_fc: 2.456, padj: 0.00012 }),
      result({ comparison_name: 'B_down', log_fc: -1.5, padj: 0.034 }),
    ]);
    renderSheet();
    const up = within(across()).getByRole('link', { name: 'A_up' }).closest('tr') as HTMLElement;
    const down = within(across()).getByRole('link', { name: 'B_down' }).closest('tr') as HTMLElement;
    expect(within(up).getByText('+2.46')).toBeInTheDocument();
    expect(within(up).getByText('1.2e-4')).toBeInTheDocument();
    expect(within(down).getByText('−1.50')).toBeInTheDocument();
    expect(within(down).getByText('0.034')).toBeInTheDocument();
  });

  it('draws a bar from zero, coloured by the direction tokens, never by red and green', () => {
    search([
      result({ comparison_name: 'A_up', log_fc: 2 }),
      result({ comparison_name: 'B_down', log_fc: -1 }),
    ]);
    renderSheet();
    const bars = within(across()).getAllByTestId('across-bar');
    const [up, down] = bars;
    expect(up.className).toContain('bg-up');
    expect(down.className).toContain('bg-down');
    // Depuis le zéro, au milieu de la piste : la hausse part vers la droite, la baisse vers la gauche.
    expect(up).toHaveStyle({ left: '50%' });
    expect(down).toHaveStyle({ right: '50%' });
    // Une même échelle pour toutes les lignes : |−1| est la moitié de |+2|.
    const widthOf = (bar: HTMLElement) => parseFloat(bar.style.width);
    expect(widthOf(down)).toBeCloseTo(widthOf(up) / 2, 5);
  });

  it('draws no bar, and no number, for a comparison that gives no fold change', () => {
    search([result({ comparison_name: 'NOFC', log_fc: null, padj: null })]);
    renderSheet();
    const row = within(across()).getByRole('link', { name: 'NOFC' }).closest('tr') as HTMLElement;
    expect(within(row).queryByTestId('across-bar')).not.toBeInTheDocument();
    expect(within(row).getAllByText('—')).toHaveLength(2);
  });

  it('marks the comparison being read, in the selection colour, and keeps its link', () => {
    search([
      result({ comparison_name: 'KO_vs_WT', dataset_id: 'deg-1' }),
      result({ comparison_name: 'DRUG_vs_CTRL', dataset_id: 'deg-2' }),
    ]);
    renderSheet();
    const current = within(across()).getByRole('link', { name: 'KO_vs_WT' }).closest('tr') as HTMLElement;
    const other = within(across()).getByRole('link', { name: 'DRUG_vs_CTRL' }).closest('tr') as HTMLElement;
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current.className).toContain('bg-plum-soft');
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('says it is looking while the search runs, and that it failed when it did', () => {
    search(null);
    const { unmount } = renderSheet();
    expect(within(across()).getByRole('status')).toHaveTextContent(/Looking through this study/);
    unmount();

    search(null, { error: true });
    renderSheet();
    expect(within(across()).getByText(/could not be read/)).toBeInTheDocument();
    expect(within(across()).queryByRole('status')).not.toBeInTheDocument();
  });

  it('says no comparison lists the gene, rather than showing an empty table', () => {
    search([result({ project_id: 'p2' })]);
    renderSheet();
    expect(within(across()).getByText('No comparison of this study lists this gene.')).toBeInTheDocument();
    expect(within(across()).queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('GeneSheet — the databases', () => {
  const link = (name: string) => screen.getByRole('link', { name });

  it('links NCBI Gene and UniProt by the symbol, each in a new tab, safely', () => {
    renderSheet('IL6');
    expect(link('NCBI Gene')).toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/gene/?term=IL6');
    expect(link('UniProt')).toHaveAttribute('href', 'https://www.uniprot.org/uniprotkb?query=gene:IL6');
    for (const name of ['NCBI Gene', 'UniProt']) {
      expect(link(name)).toHaveAttribute('target', '_blank');
      expect(link(name)).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('uses the symbol of an accession when the matrix knows it', () => {
    renderSheet('ENSG1');
    expect(link('NCBI Gene')).toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/gene/?term=TP53');
    expect(link('UniProt')).toHaveAttribute('href', 'https://www.uniprot.org/uniprotkb?query=gene:TP53');
  });

  it('encodes what it puts in a URL', () => {
    renderSheet('A&B C');
    expect(link('NCBI Gene')).toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/gene/?term=A%26B%20C');
  });

  it('does not add a second STRING link: the gene card already has one', () => {
    renderSheet('IL6');
    expect(screen.queryByRole('link', { name: /STRING/ })).not.toBeInTheDocument();
  });
});
