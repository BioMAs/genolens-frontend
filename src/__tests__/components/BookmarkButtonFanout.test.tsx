/**
 * A table of BookmarkButtons must cost ONE request, not two per row.
 *
 * On 2026-10-12 a single DEG page (25 rows) sent 50 requests at once — a
 * `/bookmarks/check/{gene}` and a `/bookmarks?gene_symbol=` per row. The burst
 * exhausted the API's database pool and every other call on the page (profile,
 * AI status, interpretation, ...) failed with a 500 for over a minute.
 *
 * Real hooks and a real QueryClient here, only the HTTP layer is mocked.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/utils/api';
import BookmarkButton from '@/components/BookmarkButton';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const PROJECT_ID = 'proj-1';
const GENES = Array.from({ length: 25 }, (_, i) => `GENE${i}`);

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {GENES.map((gene) => (
        <BookmarkButton key={gene} projectId={PROJECT_ID} geneSymbol={gene} />
      ))}
    </QueryClientProvider>,
  );
}

describe('BookmarkButton in a table', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the project bookmarks once for 25 rows, and never per gene', async () => {
    mockApi.get.mockResolvedValue({
      data: [{ id: 'bm-3', project_id: PROJECT_ID, gene_symbol: 'GENE3' }],
    });

    renderTable();

    // GENE3 is bookmarked, the 24 others are not — all derived from one list.
    await waitFor(() =>
      expect(screen.getAllByTitle('Remove bookmark')).toHaveLength(1),
    );
    expect(screen.getAllByTitle('Add bookmark')).toHaveLength(24);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/bookmarks`, { params: {} });
    const urls = mockApi.get.mock.calls.map(([url]) => url);
    expect(urls.some((url) => String(url).includes('/check/'))).toBe(false);
  });
});
