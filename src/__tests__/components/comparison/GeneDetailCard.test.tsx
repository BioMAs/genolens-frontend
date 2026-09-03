/**
 * The gene detail card, and the honesty of each of its four sections.
 *
 * The pure shaping is covered in `geneCardSources.test.ts`. What matters here is what the card
 * does when a source cannot answer — because each of the four can legitimately have nothing to
 * say about a given gene, and inventing something would be worse than saying so.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@/components/BookmarkButton', () => {
  const Stub = () => <button type="button">bookmark</button>;
  Stub.displayName = 'BookmarkButton';
  return { __esModule: true, default: Stub };
});

jest.mock('@/components/GeneExpressionBoxplot', () => {
  const Stub = ({ loading }: { loading?: boolean }) => (
    <div data-testid="boxplot">{loading ? 'loading' : 'plotted'}</div>
  );
  Stub.displayName = 'GeneExpressionBoxplot';
  return { __esModule: true, default: Stub };
});

import GeneDetailCard from '@/components/comparison/explorer/GeneDetailCard';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';
import type { Dataset } from '@/types';

const DEG = { id: 'deg-1', project_id: 'proj-1' } as Dataset;
const MATRIX = { id: 'mx-1', project_id: 'proj-1' } as Dataset;
const ENRICH = { id: 'en-1', project_id: 'proj-1' } as Dataset;
const COMPARISON = 'Treated_vs_Control';

const CLOUD = {
  points: [
    { gene: 'TP53', x: 2.4, y: 8, padj: 1e-8, is_significant: true },
    { gene: 'ENSG00000141510', x: -1.9, y: 6, padj: 1e-6, is_significant: true },
  ],
  total_genes: 2,
  significant_genes: 2,
  cached: true,
};

const PATHWAYS = {
  pathways: [
    { pathway_id: 'GO:1', pathway_name: 'Apoptosis', padj: 1e-9, genes: ['TP53'] },
    { pathway_id: 'GO:2', pathway_name: 'Cell cycle', padj: 0.001, genes: ['TP53'] },
  ],
};

const PARTNERS = {
  nodes: [{ name: 'TP53' }, { name: 'MDM2' }],
  edges: [{ source: 'TP53', target: 'MDM2', score: 0.98 }],
};

function Seed({ gene }: { gene: string }) {
  const { selectGenes } = useComparisonActions();
  React.useEffect(() => {
    selectGenes([gene], 'volcano');
  }, [gene, selectGenes]);
  return null;
}

function renderCard(props: Partial<React.ComponentProps<typeof GeneDetailCard>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>
        <Seed gene={props.gene ?? 'TP53'} />
        <GeneDetailCard
          gene="TP53"
          dataset={DEG}
          comparisonName={COMPARISON}
          matrixDataset={MATRIX}
          enrichmentDataset={ENRICH}
          {...props}
        />
      </ComparisonSelectionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockImplementation((url: string) => {
    if (url.includes('volcano-plot')) return Promise.resolve({ data: CLOUD });
    if (url.includes('enrichment-pathways')) return Promise.resolve({ data: PATHWAYS });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  mockApi.post.mockImplementation((url: string) => {
    if (url.includes('string/partners')) return Promise.resolve({ data: PARTNERS });
    if (url.includes('/query')) {
      return Promise.resolve({
        data: { columns: ['gene_id', 's1', 's2'], data: [{ gene_id: 'TP53', s1: '10', s2: '4' }] },
      });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
});

describe('statistics from the cloud', () => {
  it('reads the fold change and padj without a request of its own', async () => {
    renderCard();

    expect(await screen.findByText('+2.40')).toBeInTheDocument();
    expect(screen.getByText('1.00e-8')).toBeInTheDocument();
    // one GET for the cloud, one for the pathways — none for the statistics
    const statsCalls = mockApi.get.mock.calls.filter(([url]) => url.includes('deg-genes'));
    expect(statsCalls).toHaveLength(0);
  });

  it('says so for a gene absent from the plotted points', async () => {
    renderCard({ gene: 'BRCA1' });

    expect(
      await screen.findByText(/not among the plotted points/i)
    ).toBeInTheDocument();
  });
});

describe('enriched pathways', () => {
  it('lists the pathways containing the gene, most significant first', async () => {
    renderCard();

    expect(await screen.findByText('In 2 enriched pathways')).toBeInTheDocument();
    const listed = screen.getAllByTitle(/Apoptosis|Cell cycle/).map((el) => el.textContent);
    expect(listed[0]).toBe('Apoptosis');
  });

  it('says plainly when the gene is in none', async () => {
    renderCard({ gene: 'ENSG00000141510' });

    expect(await screen.findByText(/In no enriched pathway/i)).toBeInTheDocument();
  });

  it('omits the section entirely with no enrichment dataset', async () => {
    renderCard({ enrichmentDataset: undefined });

    await screen.findByText('+2.40');
    expect(screen.queryByText(/enriched pathway/i)).toBeNull();
  });
});

describe('interaction partners', () => {
  it('lists them, strongest first', async () => {
    renderCard();

    expect(await screen.findByText('MDM2')).toBeInTheDocument();
  });

  // STRING is keyed on symbols; querying it with an accession would return nothing and look
  // like "this gene has no partners", which is a different claim.
  it('refuses to ask STRING about a bare accession, and says why', async () => {
    renderCard({ gene: 'ENSG00000141510' });

    expect(await screen.findByText(/keyed on gene symbols/i)).toBeInTheDocument();
    expect(
      mockApi.post.mock.calls.filter(([url]) => url.includes('string/partners'))
    ).toHaveLength(0);
  });

  it('asks about the symbol when the accession has one', async () => {
    renderCard({ gene: 'ENSG00000141510', symbol: 'TP53' });

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/integrations/string/partners',
        expect.objectContaining({ gene_symbol: 'TP53' })
      )
    );
  });
});

describe('expression', () => {
  it('renders the boxplot when there is a matrix', async () => {
    renderCard();
    expect(await screen.findByTestId('boxplot')).toBeInTheDocument();
  });

  it('omits it entirely without one, rather than showing an empty frame', async () => {
    renderCard({ matrixDataset: undefined });

    await screen.findByText('+2.40');
    expect(screen.queryByTestId('boxplot')).toBeNull();
  });
});
