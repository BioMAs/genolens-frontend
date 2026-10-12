/**
 * The nova layout against the reference rendering.
 *
 * `CosmOmics_pathway_nova_flyer.svg` is the output of the reference script
 * (docs/reference/cosmomics/cosmomics_pathway_nova.py) on the very fixture used
 * here. Pixel comparison is impossible — the reference jitters with numpy's
 * generator, the app with one seeded by the dataset id — so the deterministic
 * geometry is compared number for number instead: sector edges, rings, bubble
 * radius / size / colour, and claim label positions.
 */
import fs from 'fs';
import path from 'path';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import {
  NOVA,
  formatP,
  layoutNova,
  pathwaysFor,
  seededRandom,
  wedgePath,
  type NovaLabel,
} from '@/components/cosmomics/novaLayout';
import { balanceColor, claimColor } from '@/components/cosmomics/novaPalette';
import type { CosmOmicsNovaData } from '@/types/cosmomics';

const data = mock as unknown as CosmOmicsNovaData;
const reference = fs.readFileSync(
  path.join(__dirname, '../../fixtures/cosmomics/CosmOmics_pathway_nova_flyer.svg'),
  'utf8',
);
const lines = reference.split('\n');

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function numbers(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

const layout = layoutNova(data, { seed: 'mock-dataset' });

describe('nova layout vs reference SVG', () => {
  it('draws the sectors in S_pro order, first one centred at 12 o’clock', () => {
    expect(layout.bands.map((b) => b.name)).toEqual([
      'Regeneration', 'Firming', 'Barrier', 'Anti-ageing', 'Soothing', 'Antioxidant',
      'Not linked to a claim',
    ]);
    const first = layout.bands[0];
    expect((first.start + first.end) / 2).toBeCloseTo(-90, 6);
  });

  it('matches every sector edge of the reference (solid, hatched, not linked)', () => {
    const refWedges = lines
      .filter((l) => l.startsWith(`<path d="M${NOVA.cx},${NOVA.cy}`))
      .map((l) => numbers(attrs(l).d));
    const ours: string[] = [];
    for (const band of layout.bands) {
      if (band.kind === 'other') {
        ours.push(wedgePath(band.start, band.end, NOVA.R));
      } else {
        ours.push(wedgePath(band.start, band.split, NOVA.R));
        if (band.end > band.split) ours.push(wedgePath(band.split, band.end, NOVA.R));
      }
    }
    expect(ours).toHaveLength(refWedges.length);
    ours.map(numbers).forEach((nums, i) => {
      nums.forEach((value, j) => expect(Math.abs(value - refWedges[i][j])).toBeLessThanOrEqual(0.15));
    });
  });

  it('places the p = 0.05, 10⁻⁵ and 10⁻¹⁰ rings at the reference radii', () => {
    const refRings = lines
      .filter((l) => l.startsWith('<circle') && l.includes('stroke-dasharray'))
      .map((l) => Number(attrs(l).r));
    expect(layout.rings.map((r) => r.r)).toHaveLength(refRings.length);
    layout.rings.forEach((ring, i) => expect(ring.r).toBeCloseTo(refRings[i], 1));
    expect(layout.rings.map((r) => r.kind)).toEqual(['threshold', 'tick', 'tick']);
  });

  it('gives every sub-group the reference radius, size and colour', () => {
    const refBubbles = lines
      .filter((l) => l.includes('stroke="#FFFFFF" stroke-width="1.5"'))
      .map((l) => {
        const a = attrs(l);
        const dx = Number(a.cx) - NOVA.cx;
        const dy = Number(a.cy) - NOVA.cy;
        return {
          dist: Math.hypot(dx, dy),
          angle: (Math.atan2(dy, dx) * 180) / Math.PI,
          r: Number(a.r),
          fill: a.fill.toUpperCase(),
        };
      });
    expect(layout.bubbles).toHaveLength(refBubbles.length);
    const unmatched = [...layout.bubbles];
    for (const ref of refBubbles) {
      const i = unmatched.findIndex(
        (b) =>
          Math.abs(b.radius - ref.dist) < 0.25 &&
          Math.abs(b.r - ref.r) < 0.02 &&
          b.fill.toUpperCase() === ref.fill,
      );
      expect(i).toBeGreaterThanOrEqual(0);
      const [bubble] = unmatched.splice(i, 1);
      // Same slot; only the ±0.25° jitter differs between the two generators.
      const delta = ((bubble.angle - ref.angle + 540) % 360) - 180;
      expect(Math.abs(delta)).toBeLessThan(1.5);
    }
  });

  it('writes the claim labels where the reference writes them', () => {
    const refTitles = lines
      .filter((l) => l.startsWith('<text') && l.includes('font-size="21"'))
      .map((l) => {
        const a = attrs(l);
        return { x: Number(a.x), y: Number(a.y), anchor: a['text-anchor'], text: l.replace(/<[^>]+>/g, '') };
      });
    const titles = layout.labels.map((label) => ({ ...label.lines[0], anchor: label.anchor }));
    expect(titles.map((t) => t.text)).toEqual(refTitles.map((t) => t.text));
    titles.forEach((title, i) => {
      expect(title.x).toBeCloseTo(refTitles[i].x, 0);
      expect(title.y).toBeCloseTo(refTitles[i].y, 0);
      expect(title.anchor).toBe(refTitles[i].anchor);
    });
    // Antioxidant's second line would spill over the disc: two lines, like the reference.
    const antioxidant = layout.labels.find((l) => l.bandKey === 'claim:Antioxidant')!;
    expect(antioxidant.lines.map((l) => l.text)).toEqual(['Antioxidant', '3 pathways for', '1 against']);
  });
});

describe('nova layout rules', () => {
  it('is deterministic for a seed and changes with it', () => {
    const again = layoutNova(data, { seed: 'mock-dataset' });
    expect(again.bubbles.map((b) => [b.x, b.y])).toEqual(layout.bubbles.map((b) => [b.x, b.y]));
    const other = layoutNova(data, { seed: 'another-dataset' });
    expect(other.bubbles.map((b) => b.x)).not.toEqual(layout.bubbles.map((b) => b.x));
  });

  it('keeps sub-groups for the claim in the solid part and those against in the hatched part', () => {
    for (const band of layout.bands.filter((b) => b.kind === 'claim')) {
      const hatchedIsWide = band.end - band.split > 3;
      for (const bubble of layout.bubbles.filter((b) => b.bandKey === band.key)) {
        const { delta } = bubble.subgroup;
        if (delta > 0) {
          expect(bubble.angle).toBeGreaterThan(band.start - 1);
          expect(bubble.angle).toBeLessThan(band.split + 1);
        } else if (hatchedIsWide) {
          expect(bubble.angle).toBeGreaterThan(band.split - 1);
          expect(bubble.angle).toBeLessThan(band.end + 1);
        }
      }
    }
  });

  it('drops the dust when asked, without moving anything else', () => {
    const bare = layoutNova(data, { seed: 'mock-dataset', showDust: false });
    expect(bare.dust).toEqual([]);
    expect(bare.bubbles.map((b) => [b.x, b.y])).toEqual(layout.bubbles.map((b) => [b.x, b.y]));
  });

  it('caps the radial scale at 1.04 × the best claim sub-group, recomputed per dataset', () => {
    const best = Math.max(...data.claims.map((c) => Math.max(...c.subgroups.map((s) => s.nl))));
    expect(layout.cap).toBeCloseTo(1.04 * best, 6);
  });

  it('never lets two claim labels overlap, even with 15 narrow sectors', () => {
    const many: CosmOmicsNovaData = {
      contrast: 'many',
      claims: Array.from({ length: 15 }, (_, i) => ({
        name: `Claim number ${i + 1}`,
        importance: 10 + (i % 4),
        s_pro: 8 + (i % 4),
        s_anti: 2,
        coherence: 0.8,
        n_for: 3,
        n_against: 1,
        subgroups: [
          {
            name: `Pathway ${i}`, nl: 4 + (i % 3), s_pro: 8, s_anti: 2, delta: 6, balance: 0.6, obs: 'up',
            terms: [{ id: `GO:${i}`, label: `Term ${i}`, nl: 4, effect: 1, obs: 'up' }],
          },
        ],
      })),
      unlinked: [],
    };
    const { labels } = layoutNova(many, { seed: 'x' });
    const boxes = labels.map((l: NovaLabel) => l.box);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [a, b] = [boxes[i], boxes[j]];
        const apart = a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3];
        expect(apart).toBe(true);
      }
    }
  });

  it('lays out 15 claims, 300 sub-groups and 2 000 terms well under the frame budget', () => {
    const claims = Array.from({ length: 15 }, (_, c) => ({
      name: `Claim ${c}`,
      importance: 0,
      s_pro: 0,
      s_anti: 0,
      coherence: 0,
      n_for: 0,
      n_against: 0,
      subgroups: Array.from({ length: 20 }, (_, s) => ({
        name: `Sub ${c}.${s}`,
        nl: 1.5 + ((c * 20 + s) % 9),
        s_pro: 6,
        s_anti: s % 3 === 0 ? 7 : 1,
        delta: s % 3 === 0 ? -1 : 5,
        balance: s % 3 === 0 ? -0.08 : 0.7,
        obs: 'up' as const,
        terms: Array.from({ length: s < 14 ? 7 : 6 }, (_, t) => ({
          id: `GO:${c}${s}${t}`,
          label: `Term ${t}`,
          nl: 1 + (t % 5),
          effect: (t % 4 === 0 ? -1 : 1) as 1 | -1,
          obs: 'up' as const,
        })),
      })),
    }));
    claims.forEach((claim) => {
      claim.s_pro = claim.subgroups.reduce((sum, s) => sum + s.s_pro, 0);
      claim.s_anti = claim.subgroups.reduce((sum, s) => sum + s.s_anti, 0);
      claim.importance = claim.s_pro + claim.s_anti;
    });
    const big: CosmOmicsNovaData = { contrast: 'perf', claims, unlinked: [] };
    expect(claims.flatMap((c) => c.subgroups)).toHaveLength(300);
    expect(claims.flatMap((c) => c.subgroups.flatMap((s) => s.terms)).length).toBeGreaterThanOrEqual(2000);
    const t0 = performance.now();
    const out = layoutNova(big, { seed: 'perf' });
    expect(performance.now() - t0).toBeLessThan(150);
    expect(out.bubbles).toHaveLength(300);
  });
});

describe('formatting and colours', () => {
  it('formats p like the reference', () => {
    expect(formatP(1.30103)).toBe('p = 0.050');
    expect(formatP(15.2649)).toBe('p = 5×10⁻¹⁶');
    expect(formatP(4)).toBe('p = 1×10⁻⁴');
  });

  it('pluralises the label and omits "· 0 against"', () => {
    expect(pathwaysFor({ n_for: 5, n_against: 0 })).toBe('5 pathways for');
    expect(pathwaysFor({ n_for: 1, n_against: 2 })).toBe('1 pathway for · 2 against');
  });

  it('runs the balance ramp coral → grey → green', () => {
    expect(balanceColor(-1)).toBe('#FF5F5F');
    expect(balanceColor(0)).toBe('#C9D1D9');
    expect(balanceColor(1)).toBe('#34B596');
    expect(balanceColor(5)).toBe('#34B596');
  });

  it('keeps the charter colour of each known claim and a stable fallback for others', () => {
    expect(claimColor('Barrier')).toEqual({ fill: '#47BDD7', text: '#2A6478' });
    expect(claimColor('Energising').fill).toBe('#33A8E3');
    expect(claimColor('Anti-wrinkles').fill).toBe('#5D309C');
    expect(claimColor('Healing')).toEqual(claimColor('Healing'));
    expect(['#34B596', '#FF5F5F']).not.toContain(claimColor('Healing').fill);
  });

  it('draws normal deviates with the right spread', () => {
    const rng = seededRandom('spread');
    const draws = Array.from({ length: 4000 }, () => rng.normal(0, 1));
    const mean = draws.reduce((s, v) => s + v, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((s, v) => s + (v - mean) ** 2, 0) / draws.length);
    expect(Math.abs(mean)).toBeLessThan(0.06);
    expect(Math.abs(sd - 1)).toBeLessThan(0.06);
  });
});
