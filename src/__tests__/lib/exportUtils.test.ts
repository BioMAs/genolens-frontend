/**
 * The HTML report export of the enrichment tables (GO, GSEA).
 *
 * A demo account's export carries a "DEMO" watermark — fixed, so it shows on
 * every screen while scrolling and on every printed page — and a footer line
 * saying it came from a demo account. Any other account's export is unchanged.
 */
import { exportToHTML } from '@/lib/exportUtils';

const REPORT = {
  title: 'GO Enrichment Results',
  tables: [{ title: 'Terms', data: [{ term: 'Apoptotic process', fdr: '1e-4' }] }],
  metadata: { 'Total Terms': 1 },
};

let blobs: Blob[] = [];
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

beforeEach(() => {
  blobs = [];
  // jsdom has no blob URLs and does not navigate on a download click.
  URL.createObjectURL = jest.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:report';
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

function exportedHtml(): Promise<string> {
  expect(blobs).toHaveLength(1);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blobs[0]);
  });
}

describe('exportToHTML', () => {
  it('watermarks a demo account export and says so in the footer', async () => {
    exportToHTML(REPORT, 'go_enrichment_results', { demo: true });
    const html = await exportedHtml();

    expect(html).toContain('<div class="demo-watermark" aria-hidden="true">DEMO</div>');
    expect(html).toMatch(/\.demo-watermark \{[^}]*position: fixed;/);
    expect(html).toMatch(/\.demo-watermark \{[^}]*rotate\(-35deg\)/);
    expect(html).toContain('Generated with a GenoLens demo account');
    // The report itself is still all there.
    expect(html).toContain('Apoptotic process');
  });

  it('leaves any other export unchanged', async () => {
    exportToHTML(REPORT, 'go_enrichment_results');
    const html = await exportedHtml();

    expect(html).not.toContain('DEMO');
    expect(html).not.toContain('demo-watermark');
    expect(html).not.toContain('demo account');
    expect(html).toContain('Apoptotic process');
  });
});
