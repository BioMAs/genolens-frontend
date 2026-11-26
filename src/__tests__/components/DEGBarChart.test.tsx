/**
 * Le diagramme des gènes les plus régulés compte à des seuils reçus, ceux de la page de lecture ;
 * sans eux, il garde les seuils d'ingestion (0.05 / 0.58), comparés strictement comme avant.
 *
 * Plotly est simulé (le tracé n'est pas l'objet) : ce qu'on lit, ce sont les effectifs de la
 * légende, qui disent combien de gènes montent et descendent à ces seuils.
 */
import { render, screen } from '@testing-library/react';
import DEGBarChart from '@/components/DEGBarChart';
import { ThemeProvider } from '@/contexts/ThemeContext';
import api from '@/utils/api';
import { DatasetStatus, DatasetType, type Dataset } from '@/types';
import type { VolcanoThresholds } from '@/utils/volcano';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => () => <div data-testid="plot-stub" />,
}));
jest.mock('@/hooks/useIsDemoAccount', () => ({ useIsDemoAccount: () => false }));

const dataset: Dataset = {
  id: 'deg-1',
  project_id: 'p1',
  name: 'deg-1',
  type: DatasetType.DEG,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  dataset_metadata: {},
};

const row = (gene: string, logFC: number, padj: number) => ({ gene_name: gene, log2FoldChange: logFC, padj });

/**
 * Deux gènes qui passent aux seuils d'ingestion (UP_A et DOWN_B, à 2 et -2), un qui ne passe qu'au
 * seuil lâche (UP_MILD, 0.7 — pas à 1), un dont le p est trop grand pour 0.01, et deux pile sur
 * les seuils d'ingestion, que la comparaison stricte exclut.
 */
const ROWS = [
  row('UP_A', 2, 0.001),
  row('DOWN_B', -2, 0.001),
  row('UP_MILD', 0.7, 0.001),
  row('UP_LATE', 2, 0.03),
  row('ON_PADJ', 2, 0.05),
  row('ON_LOGFC', 0.58, 0.001),
];

function renderChart(thresholds?: VolcanoThresholds) {
  return render(
    <ThemeProvider>
      <DEGBarChart dataset={dataset} comparisonName="KO_vs_WT" thresholds={thresholds} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.post.mockResolvedValue({
    data: { columns: ['gene_name', 'log2FoldChange', 'padj'], data: ROWS },
  });
});

describe('DEGBarChart thresholds', () => {
  it('keeps the ingestion thresholds, strictly, when it is given none', async () => {
    renderChart();

    expect(await screen.findByText('Upregulated (3)')).toBeInTheDocument(); // UP_A, UP_MILD, UP_LATE
    expect(screen.getByText('Downregulated (1)')).toBeInTheDocument();
  });

  it('counts at the thresholds it is given', async () => {
    renderChart({ padj: 0.01, logfc: 1 });

    expect(await screen.findByText('Upregulated (1)')).toBeInTheDocument(); // UP_A only
    expect(screen.getByText('Downregulated (1)')).toBeInTheDocument();
  });

  it('counts again when the thresholds change', async () => {
    const { rerender } = renderChart();
    expect(await screen.findByText('Upregulated (3)')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <DEGBarChart dataset={dataset} comparisonName="KO_vs_WT" thresholds={{ padj: 0.01, logfc: 1 }} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Upregulated (1)')).toBeInTheDocument();
  });

  it('does not refetch for an equal thresholds object', async () => {
    const { rerender } = renderChart({ padj: 0.01, logfc: 1 });
    await screen.findByText('Upregulated (1)');

    rerender(
      <ThemeProvider>
        <DEGBarChart dataset={dataset} comparisonName="KO_vs_WT" thresholds={{ padj: 0.01, logfc: 1 }} />
      </ThemeProvider>
    );

    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });
});
