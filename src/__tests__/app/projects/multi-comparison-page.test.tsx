/**
 * La page multi-comparaisons lit les seuils de l'étude (`useStudyThresholds`) et les passe au
 * Venn : le réglage fait dans la page de lecture d'un projet est celui que le Venn envoie.
 *
 * Le Venn est un témoin qui affiche ses propriétés ; l'API répond avec deux comparaisons.
 */
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import MultiComparisonPage from '@/app/projects/[id]/multi-comparison/page';
import api from '@/utils/api';
import { DatasetStatus, DatasetType, type Dataset } from '@/types';
import { DEFAULT_THRESHOLDS } from '@/utils/volcano';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    data: { role: 'USER', subscription_plan: 'TEAM' },
    isLoading: false,
  }),
}));
jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock('@/components/MultiComparisonVenn', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-testid="venn" data-thresholds={JSON.stringify(props.thresholds)} />
  ),
}));

const degDataset = (id: string, comparison: string): Dataset => ({
  id,
  project_id: 'p1',
  name: id,
  type: DatasetType.DEG,
  status: DatasetStatus.READY,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  dataset_metadata: { comparison_name: comparison },
});

async function renderPage(projectId = 'p1') {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MultiComparisonPage params={Promise.resolve({ id: projectId })} />
      </Suspense>
    );
  });
}

const thresholdsOfVenn = () =>
  JSON.parse(screen.getByTestId('venn').getAttribute('data-thresholds') ?? 'null');

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects/p1') return { data: { id: 'p1', name: 'Study' } };
    if (url === '/datasets/project/p1') {
      return { data: [degDataset('deg-1', 'KO_vs_WT'), degDataset('deg-2', 'HET_vs_WT')] };
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

describe('multi-comparison page thresholds', () => {
  it('passes the study thresholds to the Venn', async () => {
    window.localStorage.setItem('gl-thresholds:p1', JSON.stringify({ padj: 0.01, logfc: 1 }));

    await renderPage();

    expect(thresholdsOfVenn()).toEqual({ padj: 0.01, logfc: 1 });
  });

  it('passes the ingestion defaults when the study has no setting', async () => {
    await renderPage();

    expect(thresholdsOfVenn()).toEqual(DEFAULT_THRESHOLDS);
  });

  it('keeps the setting of another study out of it', async () => {
    window.localStorage.setItem('gl-thresholds:p2', JSON.stringify({ padj: 0.001, logfc: 3 }));

    await renderPage();

    expect(thresholdsOfVenn()).toEqual(DEFAULT_THRESHOLDS);
  });
});
