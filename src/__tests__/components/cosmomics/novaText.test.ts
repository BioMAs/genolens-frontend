/**
 * The sentences the nova writes about itself: provenance, claim states, the label of AI text.
 */
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import {
  aiLabel,
  claimStateOf,
  formatDay,
  provenanceLines,
  shortDatasetId,
  wrapNote,
} from '@/components/cosmomics/novaText';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import honest from '../../fixtures/cosmomics/honestNova.json';

const honestData = honest as unknown as CosmOmicsNovaData;

describe('novaText', () => {
  it('shortens a dataset id to its first eight characters', () => {
    expect(shortDatasetId('3f2a9c1e-0000-4000-8000-000000000001')).toBe('3f2a9c1e');
    expect(shortDatasetId(null)).toBe('');
    expect(shortDatasetId(undefined)).toBe('');
  });

  it('reads the state from the payload, and derives it from the weights when absent', () => {
    expect(claimStateOf({ state: 'against_only', s_pro: 3, s_anti: 1 })).toBe('against_only');
    expect(claimStateOf({ s_pro: 3, s_anti: 0 })).toBe('for_only');
    expect(claimStateOf({ s_pro: 0, s_anti: 2 })).toBe('against_only');
    expect(claimStateOf({ s_pro: 3, s_anti: 1 })).toBe('both_ways');
  });

  it('formats a day in UTC, whatever offset the timestamp carries', () => {
    expect(formatDay('2026-11-05T09:30:00+00:00')).toBe('2026-11-05');
    expect(formatDay('2026-11-05T23:30:00-02:00')).toBe('2026-11-06');
    expect(formatDay('2026-11-05T09:30:00.123456+00:00')).toBe('2026-11-05');
    expect(formatDay(null)).toBeNull();
    expect(formatDay('not a date')).toBeNull();
  });

  it('labels an AI text with its model and its day, and says what is not recorded', () => {
    expect(aiLabel('model-1', '2026-11-05T09:30:00+00:00')).toBe(
      'AI-generated text (model model-1, generated 2026-11-05)',
    );
    expect(aiLabel('', null)).toBe('AI-generated text (model not recorded, generated date not recorded)');
  });

  it('writes the provenance as lines, from the payload only', () => {
    const lines = provenanceLines(honestData);
    expect(lines[0]).toBe(
      'dataset 3f2a9c1e · α = 0.05 · enrichment FDR ≤ 0.05 · referential v3 · databases: Database A · ' +
        'sources: Source X 2025-01 · generated 2026-11-05 · GenoLens 2.9.1',
    );
    expect(lines[1]).toBe(
      'p-values — terms: padj (Benjamini–Hochberg, GenoLens enrichment) · ' +
        'sub-groups: combined p (Stouffer over their terms), not an adjusted p',
    );
    expect(provenanceLines(mock as unknown as CosmOmicsNovaData)[0]).toBe('provenance not recorded');
  });

  it('wraps a note on its separators first, then on words, and never cuts a word', () => {
    expect(wrapNote('aaa · bbb · ccc', 11)).toEqual(['aaa · bbb', 'ccc']);
    expect(wrapNote('aaa · bbb · ccc', 40)).toEqual(['aaa · bbb · ccc']);
    expect(wrapNote('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    expect(wrapNote('short', 50)).toEqual(['short']);
    expect(wrapNote('unbreakable-word', 5)).toEqual(['unbreakable-word']);
  });
});
