/**
 * The guard that replaces `comparisonSections.test.ts` for the reading.
 *
 * The comparison page had a section per module, and a guard proved that every module the
 * catalogue offered had a section to land on. The reading has parts and focus views instead, and
 * the same defect is just as likely: an old `?panel=` link that resolves to a part the page does
 * not have, or to a focus view the dialog cannot open, looks broken to the person who saved it.
 *
 * Driven by `COMPARISON_PANELS` itself, so a panel added upstream is checked without editing this
 * file. `comparisonSections.test.ts` stays: it still guards `ComparisonDetail`, which still exists.
 */
import { COMPARISON_PANELS } from '@/components/comparison/comparisonRoutes';
import { FOCUS_VIEWS } from '@/components/reading/FocusDialog';
import { READING_PARTS, resolveReadingTarget } from '@/components/reading/readingRoutes';

const PARTS: ReadonlySet<string> = new Set(READING_PARTS.map((p) => p.id));
const FOCUS_KEYS: ReadonlySet<string> = new Set(Object.keys(FOCUS_VIEWS));

const landing = (panel: string, hash = '') =>
  resolveReadingTarget(new URLSearchParams({ panel }), hash);

describe('every old panel link lands somewhere true', () => {
  it.each(COMPARISON_PANELS)('?panel=%s opens a part of the reading', (panel) => {
    expect(PARTS.has(landing(panel).part)).toBe(true);
  });

  it.each(COMPARISON_PANELS)('?panel=%s opens no focus view the dialog lacks', (panel) => {
    const { focus } = landing(panel);
    expect(focus === null || FOCUS_KEYS.has(focus)).toBe(true);
  });

  it('leaves no panel without a destination, all at once', () => {
    const broken = COMPARISON_PANELS.filter((panel) => {
      const { part, focus } = landing(panel);
      return !PARTS.has(part) || (focus !== null && !FOCUS_KEYS.has(focus));
    });
    expect(broken).toEqual([]);
  });

  it('opens the report layout editor for the old report tab and the old Share screen', () => {
    expect(landing('report').focus).toBe('report');
    expect(resolveReadingTarget(new URLSearchParams({ view: 'partager' }), '').focus).toBe('report');
    expect(FOCUS_KEYS.has('report')).toBe(true);
  });

  it('opens a focus view the dialog has for the GSEA fragment of the enrichment', () => {
    const { part, focus } = landing('enrichment', '#gsea');
    expect(PARTS.has(part)).toBe(true);
    expect(focus).not.toBeNull();
    expect(FOCUS_KEYS.has(focus as string)).toBe(true);
  });
});
