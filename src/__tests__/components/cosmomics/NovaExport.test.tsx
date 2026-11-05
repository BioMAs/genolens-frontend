/**
 * The exported figure says what it was computed from, draws only data, and is
 * marked DEMO when the dataset is a demonstration one.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import { NovaExportFigure, useNovaExport } from '@/components/cosmomics/NovaExport';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import honest from '../../fixtures/cosmomics/honestNova.json';

const mockExportSvg = jest.fn();
const mockExportPng = jest.fn();
const mockIsDemo = jest.fn();
jest.mock('@/utils/chartExport', () => ({
  exportChartSvg: (...args: unknown[]) => mockExportSvg(...args),
  exportChartPng: (...args: unknown[]) => mockExportPng(...args),
}));
jest.mock('@/hooks/useIsDemoAccount', () => ({ useIsDemoAccount: () => mockIsDemo() }));

const data = mock as unknown as CosmOmicsNovaData;
const honestData = honest as unknown as CosmOmicsNovaData;

/** Every line the figure writes, one space between lines, as one string. */
function figureText(props: Partial<React.ComponentProps<typeof NovaExportFigure>> = {}) {
  const { container } = render(<NovaExportFigure data={honestData} seed="export" {...props} />);
  return Array.from(container.querySelectorAll('text'))
    .map((t) => t.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ');
}

describe('exported figure', () => {
  it('export footer carries provenance and no BH claim for sub-groups', () => {
    const text = figureText();
    expect(text).toContain('dataset 3f2a9c1e');
    expect(text).not.toContain('3f2a9c1e-0000');
    expect(text).toContain('α = 0.05');
    expect(text).toContain('referential v3');
    expect(text).toContain('sources: Source X 2025-01');
    expect(text).toContain('enrichment FDR ≤ 0.05');
    expect(text).toContain('generated 2026-11-05');
    expect(text).toContain('GenoLens 2.9.1');
    // What the p-values are: the terms' column as the payload names it, the sub-groups' combined p.
    expect(text).toContain('terms: padj (Benjamini–Hochberg, GenoLens enrichment)');
    expect(text).toContain('sub-groups: combined p (Stouffer over their terms), not an adjusted p');
    expect(text).not.toMatch(/adjusted p \(Benjamini–Hochberg\)/);
  });

  it('leaves out the sources when there are none, and says so when the provenance is unknown', () => {
    const noSources = { ...honestData, provenance: { ...honestData.provenance!, source_versions: [] } };
    expect(figureText({ data: noSources })).not.toContain('sources:');
    const unrecorded = {
      ...honestData,
      provenance: { ...honestData.provenance!, enrichment_fdr: null, referential_version: null },
    };
    const text = figureText({ data: unrecorded });
    expect(text).toContain('enrichment FDR not recorded');
    expect(text).toContain('referential version not recorded');
    // The reference fixture and older payloads carry no provenance at all.
    expect(figureText({ data })).toContain('provenance not recorded');
  });

  it('prints the extra footer line the caller asks for (bench marking, demo note)', () => {
    expect(figureText({ footer: 'Illustrative data · not study results' })).toContain(
      'Illustrative data · not study results',
    );
  });

  it('export has no decorative dots', () => {
    const { container } = render(<NovaExportFigure data={data} seed="export" />);
    expect(container.querySelectorAll('path[d*="a.7,.7"]')).toHaveLength(0);
    // The nova's own marks are there, though.
    expect(container.querySelectorAll('circle[data-subgroup]').length).toBeGreaterThan(0);
  });

  it('export says 12 of N not-linked sub-groups drawn', () => {
    const many: CosmOmicsNovaData = {
      ...honestData,
      unlinked: Array.from({ length: 12 }, (_, i) => ({ ...honestData.unlinked[0], name: `Other ${i}` })),
      unlinked_total: 40,
    };
    expect(figureText({ data: many })).toContain('12 of 40 not-linked sub-groups drawn');
  });

  it('writes the legend of what is drawn: balanced, faded terms, coherence, not evaluated', () => {
    const text = figureText();
    expect(text).toContain('Balanced: evidence for and against cancels (Δ = 0), counted neither for nor against');
    expect(text).toContain('Faded dot: term not significant at α');
    expect(text).toContain('Terms not significant at α still contribute with their weight.');
    expect(text).toContain('Coherence = S pro / (S pro + S anti)');
    expect(text).toContain('Not evaluated: Claim C, Claim D');
    // R-T6-1: what n.e. means, without a claim about what is stored.
    expect(text).toContain('n.e. — no significant term for this claim in the enrichment results');
    expect(text).not.toContain('not stored');
  });

  it('the exported figure counts sub-groups as sub-groups, never as pathways', () => {
    for (const nova of [honestData, data]) {
      const text = figureText({ data: nova });
      expect(text).not.toMatch(/\b\d+ pathways?\b/i);
      expect(text).toMatch(/\b\d+ sub-groups? for\b/);
      cleanup();
    }
    // The sector label and the legend note agree on the unit: "40 sub-groups · 3 drawn".
    const text = figureText();
    expect(text).toMatch(/40 sub-groups(?: ·)? 3 drawn/);
    expect(text).toContain('3 of 40 not-linked sub-groups drawn');
  });

  it('wraps its notes inside the frame: no line is longer than the figure is wide', () => {
    const long = {
      ...honestData,
      provenance: {
        ...honestData.provenance!,
        source_versions: Array.from({ length: 8 }, (_, i) => `Source number ${i} release 2025-0${i + 1}`),
      },
    };
    const { container } = render(<NovaExportFigure data={long} seed="export" />);
    const notes = Array.from(container.querySelectorAll('text[data-note]'));
    expect(notes.length).toBeGreaterThan(3);
    for (const note of notes) expect((note.textContent ?? '').length).toBeLessThanOrEqual(150);
  });
});

function Harness({ nova }: { nova: CosmOmicsNovaData }) {
  const exporter = useNovaExport({ data: nova, seed: 'export', filename: 'nova', footer: '' });
  return (
    <>
      <button onClick={() => void exporter.run('svg')}>export svg</button>
      <button onClick={() => void exporter.run('png')}>export png</button>
      {exporter.figure}
    </>
  );
}

describe('export marking', () => {
  beforeEach(() => {
    mockExportSvg.mockReset().mockResolvedValue(undefined);
    mockExportPng.mockReset().mockResolvedValue(undefined);
    mockIsDemo.mockReset().mockReturnValue(false);
    // No logo in a unit test: the wordmark is written instead.
    global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  });

  async function exportedWith(nova: CosmOmicsNovaData, kind: 'svg' | 'png' = 'svg') {
    render(<Harness nova={nova} />);
    fireEvent.click(screen.getByText(`export ${kind}`));
    const fn = kind === 'svg' ? mockExportSvg : mockExportPng;
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    return fn.mock.calls[0][1] as { demo?: boolean };
  }

  it('demo dataset export is marked DEMO', async () => {
    const demo = { ...honestData, provenance: { ...honestData.provenance!, demo: true } };
    // The viewing account is not a demo one: the dataset alone marks the export.
    expect((await exportedWith(demo)).demo).toBe(true);
  });

  it('marks the PNG of a demo dataset too', async () => {
    const demo = { ...honestData, provenance: { ...honestData.provenance!, demo: true } };
    expect((await exportedWith(demo, 'png')).demo).toBe(true);
  });

  it('marks nothing for a real dataset viewed by a real account', async () => {
    expect((await exportedWith(honestData)).demo).toBe(false);
  });

  it('keeps marking the export of a demo account, whatever the payload says', async () => {
    mockIsDemo.mockReturnValue(true);
    expect((await exportedWith(data)).demo).toBe(true);
  });
});
