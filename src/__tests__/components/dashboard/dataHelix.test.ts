/**
 * L'helice de donnees du dashboard : la geometrie et la traduction des
 * comparaisons en paires de bases.
 *
 * Teste sans DOM, parce que c'est la que vivent les erreurs qui ne se voient
 * pas a l'oeil : une paire « up » dessinee du mauvais cote, une rotation qui
 * prend le chemin long, une comparaison recente qui tombe hors de l'helice.
 */
import {
  comparisonsToPairs,
  computeFrame,
  layoutFor,
  pairKey,
  phaseToFace,
  rungX,
  upShare,
} from '@/components/dashboard/helix/helixGeometry';
import { comparisonTitle, formatRelative } from '@/components/dashboard/format';

const cmp = (name: string, up: number, down: number, updated_at: string, project_id = 'p1') => ({
  project_id,
  name,
  deg_up: up,
  deg_down: down,
  updated_at,
});

describe('comparisonsToPairs', () => {
  it('orders the pairs oldest to newest, then pads with free slots', () => {
    const pairs = comparisonsToPairs(
      [cmp('B', 1, 1, '2026-10-02T00:00:00Z'), cmp('A', 1, 1, '2026-10-01T00:00:00Z')],
      4,
    );
    expect(pairs.map((p) => p.key)).toEqual(['p1::A', 'p1::B', 'ghost-2', 'ghost-3']);
    expect(pairs.filter((p) => p.ghost)).toHaveLength(2);
  });

  it('keeps only the most recent comparisons when there are more than slots', () => {
    const pairs = comparisonsToPairs(
      [
        cmp('old', 1, 1, '2026-01-01T00:00:00Z'),
        cmp('mid', 1, 1, '2026-06-01T00:00:00Z'),
        cmp('new', 1, 1, '2026-10-01T00:00:00Z'),
      ],
      2,
    );
    expect(pairs.map((p) => p.key)).toEqual(['p1::mid', 'p1::new']);
  });

  it('never draws a negative half', () => {
    const [pair] = comparisonsToPairs([cmp('X', -5, 3, '2026-10-01T00:00:00Z')], 1);
    expect(pair.up).toBe(0);
    expect(pair.down).toBe(3);
  });

  it('keys a pair by project AND comparison — the same name exists in many projects', () => {
    expect(pairKey({ project_id: 'p1', name: 'KO_vs_WT' })).not.toBe(
      pairKey({ project_id: 'p2', name: 'KO_vs_WT' }),
    );
  });
});

describe('upShare', () => {
  it('is the up proportion of the response', () => {
    expect(upShare({ up: 300, down: 100 })).toBe(0.75);
  });

  it('splits an empty pair evenly rather than dividing by zero', () => {
    expect(upShare({ up: 0, down: 0 })).toBe(0.5);
  });
});

describe('computeFrame', () => {
  const layout = layoutFor(600, 200, 12);

  it('places the two ends of every rung symmetrically about the axis', () => {
    const frame = computeFrame(layout, 0.7, []);
    for (const r of frame.rungs) {
      expect(r.yA + r.yB).toBeCloseTo(layout.height, 6);
    }
  });

  it('splits each rung at its up share, measured from strand A', () => {
    const pairs = Array.from({ length: 12 }, () => ({ up: 3, down: 1 }));
    const frame = computeFrame(layout, 1.1, pairs);
    for (const r of frame.rungs) {
      expect(r.ySplit).toBeCloseTo(r.yA + (r.yB - r.yA) * 0.75, 6);
    }
  });

  it('keeps every rung inside the usable width', () => {
    const frame = computeFrame(layout, 0, []);
    expect(frame.rungs[0].x).toBeGreaterThan(layout.padX);
    expect(frame.rungs[frame.rungs.length - 1].x).toBeLessThan(layout.width - layout.padX);
  });

  it('splits each strand into a front and a back trace', () => {
    const frame = computeFrame(layout, 0.3, []);
    for (const s of [frame.strandA, frame.strandB]) {
      expect(s.front).toMatch(/^M/);
      expect(s.back).toMatch(/^M/);
    }
  });
});

describe('phaseToFace', () => {
  const layout = layoutFor(600, 200, 12);

  it('turns the chosen rung face-on, up half on top', () => {
    for (const i of [0, 5, 11]) {
      const phase = phaseToFace(layout, i, 0);
      const r = computeFrame(layout, phase, []).rungs[i];
      expect(r.face).toBeCloseTo(1, 6);
      expect(r.yA).toBeLessThan(r.yB); // brin A (up) en haut
      expect(r.x).toBeCloseTo(rungX(layout, i), 6);
    }
  });

  it('takes the short way round from the current phase', () => {
    const current = 40;
    const phase = phaseToFace(layout, 3, current);
    expect(Math.abs(phase - current)).toBeLessThanOrEqual(Math.PI);
  });
});

describe('format helpers', () => {
  const now = new Date('2026-10-11T12:00:00Z');

  it('says how long ago, coarsening with age', () => {
    expect(formatRelative('2026-10-11T11:59:40Z', now)).toBe('just now');
    expect(formatRelative('2026-10-11T11:48:00Z', now)).toBe('12m ago');
    expect(formatRelative('2026-10-11T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelative('2026-10-10T08:00:00Z', now)).toBe('Yesterday');
    expect(formatRelative('2026-10-06T12:00:00Z', now)).toBe('5d ago');
    expect(formatRelative('2026-09-02T12:00:00Z', now)).toBe('Sep 2');
  });

  it('renders a missing or broken date as a dash', () => {
    expect(formatRelative(null, now)).toBe('—');
    expect(formatRelative('not a date', now)).toBe('—');
  });

  it('turns a contrast name into a title', () => {
    expect(comparisonTitle('Treated_vs_Control')).toBe('Treated vs Control');
    expect(comparisonTitle('UVB_24h_vs_Sham')).toBe('UVB 24h vs Sham');
    expect(comparisonTitle('KO vs WT')).toBe('KO vs WT');
  });
});
