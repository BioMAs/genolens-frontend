/**
 * The dataset page: its table and its Export button.
 *
 * Both were broken at once. The table read `GET /datasets/{id}/data`, a route the backend never
 * had (404 in production), so the page showed an error; and the Export button had no handler.
 * The table now reads `POST /datasets/{id}/query`, and Export walks that same endpoint for every
 * matching row — not the 50 on screen.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DatasetExplorer from '@/components/DatasetExplorer';
import { fetchAllDatasetRows } from '@/hooks/useDatasets';
import api from '@/utils/api';
import { captureDownloads } from '@/test-utils/downloads';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// Recharts has nothing to do with the table or the export.
jest.mock('@/components/DatasetVisualizer', () => {
  const Stub = () => <div data-testid="DatasetVisualizer" />;
  Stub.displayName = 'DatasetVisualizer';
  return { __esModule: true, default: Stub };
});

const COLUMNS = ['gene_id', 'KO_1', 'WT_1'];
// 120 rows: more than the 50-row page on screen, so an export of "what is visible" would show.
const ROWS = Array.from({ length: 120 }, (_, i) => ({
  gene_id: `G${i + 1}`,
  KO_1: i * 10,
  WT_1: i,
}));

type QueryBody = { limit: number; offset: number; columns?: string[] };

function project(row: Record<string, unknown>, columns?: string[]) {
  if (!columns) return row;
  return Object.fromEntries(columns.map((c) => [c, row[c]]));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockImplementation(((url: string) => {
    if (url.endsWith('/columns')) {
      return Promise.resolve({ data: { columns: COLUMNS, total_rows: ROWS.length } });
    }
    return Promise.resolve({
      data: { id: 'ds1', name: 'Liver counts (v2)', type: 'MATRIX', status: 'READY' },
    });
  }) as typeof api.get);
  mockApi.post.mockImplementation(((url: string, body: QueryBody) => {
    const page = ROWS.slice(body.offset, body.offset + body.limit).map((r) =>
      project(r, body.columns)
    );
    return Promise.resolve({
      data: {
        columns: body.columns ?? COLUMNS,
        data: page,
        total_rows: ROWS.length,
        returned_rows: page.length,
      },
    });
  }) as typeof api.post);
});

function renderExplorer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DatasetExplorer projectId="p1" datasetId="ds1" />
    </QueryClientProvider>
  );
}

describe('the table', () => {
  it('loads through POST /query, the endpoint that exists', async () => {
    renderExplorer();

    expect(await screen.findByText('G1')).toBeInTheDocument();
    expect(mockApi.post).toHaveBeenCalledWith(
      '/datasets/ds1/query',
      expect.objectContaining({ limit: 50, offset: 0 })
    );
    expect(mockApi.get).not.toHaveBeenCalledWith(expect.stringMatching(/\/data$/), expect.anything());
  });
});

describe('Export', () => {
  let downloads: ReturnType<typeof captureDownloads>;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    downloads = captureDownloads();
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    downloads.restore();
    alertSpy.mockRestore();
  });

  async function exportAs(label: 'Export CSV' | 'Export JSON') {
    const user = userEvent.setup();
    renderExplorer();
    await screen.findByText('G1');
    await user.click(screen.getByRole('button', { name: /^export$/i }));
    await user.click(screen.getByText(label));
    await waitFor(() => expect(downloads.count()).toBe(1));
    return (await downloads.files())[0];
  }

  it('downloads every row as CSV, not the 50 on screen', async () => {
    const file = await exportAs('Export CSV');

    expect(file.filename).toBe('Liver_counts_v2.csv');
    const [header, ...rows] = file.text.split('\n');
    expect(header).toBe('gene_id,KO_1,WT_1');
    expect(rows).toHaveLength(120);
    expect(rows[0]).toBe('G1,0,0');
    expect(rows[119]).toBe('G120,1190,119');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('downloads every row as JSON', async () => {
    const file = await exportAs('Export JSON');

    expect(file.filename).toBe('Liver_counts_v2.json');
    expect(JSON.parse(file.text)).toEqual(ROWS);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('exports only the columns picked in the selector', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await screen.findByText('G1');

    await user.click(screen.getByRole('button', { name: /columns/i }));
    const menu = screen.getByRole('menu');
    await user.click(within(menu).getByLabelText('gene_id'));
    await user.click(within(menu).getByLabelText('KO_1'));

    await user.click(screen.getByRole('button', { name: /^export$/i }));
    await user.click(screen.getByText('Export CSV'));
    await waitFor(() => expect(downloads.count()).toBe(1));

    const [file] = await downloads.files();
    const [header, ...rows] = file.text.split('\n');
    expect(header).toBe('gene_id,KO_1');
    expect(rows).toHaveLength(120);
    expect(rows[1]).toBe('G2,10');
  });
});

describe('fetchAllDatasetRows', () => {
  it('walks every page until the last row', async () => {
    const rows = await fetchAllDatasetRows('ds1', {}, 50);

    expect(rows).toEqual(ROWS);
    expect(mockApi.post.mock.calls.map(([, body]) => (body as QueryBody).offset)).toEqual([0, 50, 100]);
  });
});
