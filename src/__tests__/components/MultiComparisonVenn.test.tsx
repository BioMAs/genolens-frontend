/**
 * Le Venn multi-comparaisons lit les seuils de l'étude au lieu de les porter en dur : le corps de
 * la requête les transmet tels quels, et la page les montre, sans les rendre modifiables — le
 * réglage se fait dans la page de lecture, une seule fois par étude.
 *
 * Les graphiques (UpSet, Venn proportionnel) et l'enrichissement sont simulés : ce qu'on vérifie
 * est ce qui part vers l'API et ce qui s'affiche près du bouton.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiComparisonVenn, { type ComparisonRef } from '@/components/MultiComparisonVenn';
import { ThemeProvider } from '@/contexts/ThemeContext';
import api from '@/utils/api';
import { DEFAULT_THRESHOLDS, type VolcanoThresholds } from '@/utils/volcano';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@upsetjs/react', () => ({
  UpSetJS: () => null,
  extractCombinations: () => ({ sets: [], combinations: [] }),
}));
jest.mock('@/components/viz/ProportionalVenn', () => ({
  __esModule: true,
  default: () => <div data-testid="proportional-venn" />,
}));
jest.mock('@/hooks/useIntersectionEnrichment', () => ({
  useIntersectionEnrichment: () => ({
    status: 'idle',
    result: null,
    error: null,
    jobId: null,
    run: jest.fn(),
    reset: jest.fn(),
  }),
}));

const COMPARISONS: ComparisonRef[] = [
  { key: 'deg-1::KO_vs_WT', datasetId: 'deg-1', comparisonName: 'KO_vs_WT', label: 'KO_vs_WT', degCount: 120 },
  { key: 'deg-1::HET_vs_WT', datasetId: 'deg-1', comparisonName: 'HET_vs_WT', label: 'HET_vs_WT', degCount: 80 },
];

function renderVenn(thresholds: VolcanoThresholds) {
  return render(
    <ThemeProvider>
      <MultiComparisonVenn
        projectId="p1"
        pathDatasetId="deg-1"
        comparisons={COMPARISONS}
        thresholds={thresholds}
      />
    </ThemeProvider>
  );
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /KO_vs_WT/ }));
  await user.click(screen.getByRole('checkbox', { name: /HET_vs_WT/ }));
  await user.click(screen.getByRole('button', { name: 'Generate analysis' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.post.mockResolvedValue({
    data: { sets: ['KO_vs_WT', 'HET_vs_WT'], set_genes: { KO_vs_WT: ['A', 'B'], HET_vs_WT: ['B', 'C'] } },
  });
});

describe('MultiComparisonVenn thresholds', () => {
  it('sends the study thresholds in the request body', async () => {
    const user = userEvent.setup();
    renderVenn({ padj: 0.01, logfc: 1 });

    await generate(user);

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post).toHaveBeenCalledWith('/datasets/deg-1/venn-analysis', {
      comparison_refs: [
        { dataset_id: 'deg-1', comparison_name: 'KO_vs_WT', label: 'KO_vs_WT' },
        { dataset_id: 'deg-1', comparison_name: 'HET_vs_WT', label: 'HET_vs_WT' },
      ],
      padj_threshold: 0.01,
      logfc_threshold: 1,
    });
  });

  it('sends the ingestion defaults for a study nobody tightened', async () => {
    const user = userEvent.setup();
    renderVenn(DEFAULT_THRESHOLDS);

    await generate(user);

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({ padj_threshold: 0.05, logfc_threshold: 0.58 });
  });

  it('shows the thresholds it uses, strictly worded and read-only, near the run button', () => {
    renderVenn({ padj: 0.01, logfc: 1 });

    const note = screen.getByText('Thresholds: padj < 0.01, |log2FC| > 1');
    const button = screen.getByRole('button', { name: 'Generate analysis' });
    expect(note.parentElement).toBe(button.parentElement);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('follows the study when its thresholds change', () => {
    const { rerender } = renderVenn({ padj: 0.01, logfc: 1 });
    rerender(
      <ThemeProvider>
        <MultiComparisonVenn
          projectId="p1"
          pathDatasetId="deg-1"
          comparisons={COMPARISONS}
          thresholds={{ padj: 0.001, logfc: 2 }}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Thresholds: padj < 0.001, |log2FC| > 2')).toBeInTheDocument();
  });
});
