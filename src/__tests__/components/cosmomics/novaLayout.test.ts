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
import { scaleSqrt } from 'd3';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import {
  NOVA,
  centreLabel,
  formatP,
  layoutNova,
  polar,
  resolveLabelOverlaps,
  subgroupsFor,
  seededRandom,
  subgroupSide,
  wedgePath,
  type NovaLabel,
} from '@/components/cosmomics/novaLayout';
import { balanceColor, claimColor } from '@/components/cosmomics/novaPalette';
import type { CosmOmicsNovaData, NovaClaim, NovaSubgroup } from '@/types/cosmomics';
import honest from '../../fixtures/cosmomics/honestNova.json';

const data = mock as unknown as CosmOmicsNovaData;
const honestData = honest as unknown as CosmOmicsNovaData;
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

// Where a label box stands against the disc the labels must keep out of: radius R + 4 around the centre.
const discRadius = NOVA.R + 4;
const distanceToCentre = ([x0, y0, x1, y1]: NovaLabel['box']) =>
  Math.hypot(Math.max(x0 - NOVA.cx, 0, NOVA.cx - x1), Math.max(y0 - NOVA.cy, 0, NOVA.cy - y1));
const apart = (a: NovaLabel['box'], b: NovaLabel['box']) => a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3];

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
      expect(title.anchor).toBe(refTitles[i].anchor);
      // The reference sets "Not linked to a claim" over the wheel (its box reaches the grey bubbles
      // and the 10⁻⁵ tick): that one label is pushed off the disc, tested below. Every label that
      // touches nothing stands where the reference puts it.
      if (title.text !== 'Not linked to a claim') expect(title.y).toBeCloseTo(refTitles[i].y, 0);
    });
    // A label that stands in its reference place needs no leader line; the one that was pushed has one.
    expect(layout.labels.filter((l) => l.leader).map((l) => l.bandKey)).toEqual(['other']);
    const notLinkedRef = refTitles.find((t) => t.text === 'Not linked to a claim')!;
    const notLinked = layout.labels.find((l) => l.bandKey === 'other')!;
    expect(distanceToCentre(notLinked.box)).toBeGreaterThanOrEqual(discRadius);
    expect(notLinked.lines[0].y).toBeLessThan(notLinkedRef.y); // it stood above the centre: pushed up
    // Antioxidant's second line would spill over the disc: two lines, like the reference (only the unit word differs: sub-groups).
    const antioxidant = layout.labels.find((l) => l.bandKey === 'claim:Antioxidant')!;
    expect(antioxidant.lines.map((l) => l.text)).toEqual(['Antioxidant', '3 sub-groups for', '1 against']);
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
        const side = subgroupSide(bubble.subgroup);
        if (side === 'for') {
          expect(bubble.angle).toBeGreaterThan(band.start - 1);
          expect(bubble.angle).toBeLessThan(band.split + 1);
        } else if (hatchedIsWide) {
          expect(bubble.angle).toBeGreaterThan(band.split - 1);
          expect(bubble.angle).toBeLessThan(band.end + 1);
        }
      }
    }
  });

  it('puts a balanced sub-group in the solid part, never in the hatched one', () => {
    const honestLayout = layoutNova(honestData, { seed: 'honest' });
    const band = honestLayout.bands.find((b) => b.name === 'Claim B')!;
    const balanced = honestLayout.bubbles.find((b) => b.subgroup.name === 'Sub-group B3')!;
    const against = honestLayout.bubbles.find((b) => b.subgroup.name === 'Sub-group B2')!;
    expect(band.end).toBeGreaterThan(band.split);
    expect(balanced.angle).toBeGreaterThan(band.start - 1);
    expect(balanced.angle).toBeLessThan(band.split + 1);
    expect(against.angle).toBeGreaterThan(band.split - 1);
    // Grey, not coral: the balance ramp reads 0 as neutral.
    expect(balanced.fill.toUpperCase()).toBe('#C9D1D9');
  });

  it('draws no decorative dust unless asked, and asking moves nothing else', () => {
    expect(layout.dust).toEqual([]);
    const dusty = layoutNova(data, { seed: 'mock-dataset', showDust: true });
    expect(dusty.dust.length).toBeGreaterThan(0);
    expect(dusty.bubbles.map((b) => [b.x, b.y])).toEqual(layout.bubbles.map((b) => [b.x, b.y]));
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

describe('what the nova draws says what the payload says', () => {
  const radiusOf = (cap: number, nl: number) => scaleSqrt().domain([0, cap]).range([30, NOVA.R - 10]).clamp(true)(nl);

  it('the significance ring follows data.alpha', () => {
    const ring = (alpha?: number) =>
      layoutNova({ ...honestData, alpha }, { seed: 'honest' }).rings.find((r) => r.kind === 'threshold')!;
    const strict = layoutNova({ ...honestData, alpha: 0.01 }, { seed: 'honest' });
    const at = (a: number) => radiusOf(strict.cap, -Math.log10(a));
    expect(ring(0.01).r).toBeCloseTo(at(0.01), 6);
    expect(ring(0.1).r).toBeCloseTo(at(0.1), 6);
    expect(ring(0.01).r).toBeGreaterThan(ring(0.1).r);
    expect(ring(0.01).label).toBe('p = 0.01');
    expect(ring(0.1).label).toBe('p = 0.1');
    // No alpha in the payload: the default of the whole module.
    expect(ring(undefined).label).toBe('p = 0.05');
    // An explicit option still wins over the payload.
    const forced = layoutNova({ ...honestData, alpha: 0.01 }, { seed: 'honest', alpha: 0.1 });
    expect(forced.rings.find((r) => r.kind === 'threshold')!.label).toBe('p = 0.1');
  });

  it('draws a term that is not significant faded, a significant one opaque', () => {
    const { bubbles } = layoutNova(honestData, { seed: 'honest' });
    const dots = bubbles.find((b) => b.subgroup.name === 'Sub-group B2')!.terms;
    const significant = dots.find((d) => d.term.id === 'TERM:0005')!;
    const faded = dots.find((d) => d.term.id === 'TERM:0006')!;
    expect(significant.opacity).toBeGreaterThan(faded.opacity);
    expect(faded.opacity).toBeLessThan(0.5);

    // The backend's flag decides, not a guess from the p: here p is small but the flag is off.
    const flagged: CosmOmicsNovaData = JSON.parse(JSON.stringify(honestData));
    flagged.claims[0].subgroups[0].terms[0].significant = false;
    const [dot] = layoutNova(flagged, { seed: 'honest' }).bubbles.find(
      (b) => b.subgroup.name === 'Sub-group A1',
    )!.terms;
    expect(dot.term.nl).toBe(6);
    expect(dot.opacity).toBeLessThan(0.5);
  });

  it('places each term dot at the radius of its own p, with no radial jitter', () => {
    const l = layoutNova(honestData, { seed: 'honest' });
    for (const bubble of l.bubbles) {
      for (const dot of bubble.terms) {
        const dist = Math.hypot(dot.x - NOVA.cx, dot.y - NOVA.cy);
        // Angular jitter moves a dot along its circle, never in or out.
        expect(dist).toBeCloseTo(radiusOf(l.cap, dot.term.nl), 6);
      }
    }
  });

  it('counts the not-linked sub-groups drawn out of the total, and says so in the sector label', () => {
    const l = layoutNova(honestData, { seed: 'honest' });
    expect(l.unlinked).toEqual({ total: 40, drawn: 3, termsCapped: false });
    const label = l.labels.find((x) => x.bandKey === 'other')!;
    expect(label.lines.map((line) => line.text).join(' ')).toMatch(/40 sub-groups/);
    expect(label.lines.map((line) => line.text).join(' ')).toMatch(/3 drawn/);

    const many: CosmOmicsNovaData = {
      ...honestData,
      unlinked: Array.from({ length: 15 }, (_, i) => ({
        ...honestData.unlinked[0],
        name: `Other ${i}`,
        terms: Array.from({ length: 10 }, (_, t) => ({ ...honestData.unlinked[0].terms[0], id: `T:${i}.${t}` })),
      })),
      unlinked_total: 15,
    };
    const capped = layoutNova(many, { seed: 'honest' });
    expect(capped.unlinked).toEqual({ total: 15, drawn: 12, termsCapped: true });
    expect(capped.bubbles.filter((b) => b.claimName === null)).toHaveLength(12);
  });

  it('writes the numerator of the contrast in the centre, never a made-up "Active"', () => {
    expect(layout.condition).toBe('Mock active');
    expect(layoutNova({ ...honestData, condition: undefined }, { seed: 'x' }).condition).toBe('Group X');
    expect(layoutNova({ ...honestData, condition: undefined, contrast: '' }, { seed: 'x' }).condition).toBe('');
    expect(layoutNova(honestData, { seed: 'x' }).condition).toBe('Group X');
  });

  it('derives the side of a sub-group from its delta, balanced within the backend tolerance', () => {
    expect(subgroupSide({ delta: 2 })).toBe('for');
    expect(subgroupSide({ delta: -0.5 })).toBe('against');
    expect(subgroupSide({ delta: 0 })).toBe('balanced');
    expect(subgroupSide({ delta: 1e-12 })).toBe('balanced');
  });
});

describe('the centre name and the labels around the wheel', () => {
  it('fits the condition in the centre disc and keeps the full name in the title', () => {
    expect(centreLabel('')).toEqual({ text: '', fontSize: 13, title: '' });
    expect(centreLabel('A')).toEqual({ text: 'A', fontSize: 13, title: 'A' });
    // 6 characters is the last one printed at 13 px, 8 the last one printed whole.
    expect(centreLabel('Sample')).toEqual({ text: 'Sample', fontSize: 13, title: 'Sample' });
    expect(centreLabel('Control')).toEqual({ text: 'Control', fontSize: 11, title: 'Control' });
    expect(centreLabel('Sample_1')).toEqual({ text: 'Sample_1', fontSize: 11, title: 'Sample_1' });
    expect(centreLabel('Treatment')).toEqual({ text: 'Treatme…', fontSize: 11, title: 'Treatment' });
    expect(centreLabel('Treatment_C')).toEqual({ text: 'Treatme…', fontSize: 11, title: 'Treatment_C' });
  });

  it('counts characters, not UTF-16 units, as the backend does', () => {
    const nine = '😀'.repeat(9);
    expect(centreLabel(nine)).toEqual({ text: `${'😀'.repeat(7)}…`, fontSize: 11, title: nine });
  });

  const subgroup = (name: string, nl: number, sPro: number, sAnti: number): NovaSubgroup => ({
    name,
    nl,
    s_pro: sPro,
    s_anti: sAnti,
    delta: sPro - sAnti,
    balance: (sPro - sAnti) / (sPro + sAnti),
    obs: 'up',
    terms: [{ id: `GO:${name}`, label: `Term of ${name}`, nl, effect: 1, obs: 'up' }],
  });
  const claimOf = (n: number, weight: number): NovaClaim => {
    const sPro = 0.8 * weight;
    const sAnti = weight - sPro;
    return {
      name: `Claim ${n} long name xx`,
      importance: weight,
      s_pro: sPro,
      s_anti: sAnti,
      coherence: 0.8,
      n_for: 1,
      n_against: 0,
      subgroups: [subgroup(`Pathway ${n}`, 3 + (n % 3), sPro, sAnti)],
    };
  };
  // Three broad claims, then six narrow neighbours of under 4 % of the weight each: their labels
  // (20 characters) are far wider than their sectors and crowd the left of the wheel.
  const nineWeights = [30, 25, 20, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4];
  const nine: CosmOmicsNovaData = {
    contrast: 'Group_A vs Group_B',
    claims: nineWeights.map((weight, i) => claimOf(i + 1, weight)),
    unlinked: [subgroup('Unlinked 1', 4, 5, 1), subgroup('Unlinked 2', 3, 4, 1), subgroup('Unlinked 3', 2.5, 3, 1)],
  };

  it('keeps every label clear of the other labels and of the wheel, and inside the frame', () => {
    const total = nineWeights.reduce((sum, w) => sum + w, 0);
    expect(nineWeights.filter((w) => w / total < 0.04)).toHaveLength(6);
    expect(nine.claims.every((c) => c.name.length === 20)).toBe(true);

    const { labels, bounds } = layoutNova(nine, { seed: 'nine' });
    expect(labels).toHaveLength(10); // nine claims and the "not linked" sector
    const boxes = labels.map((l) => l.box);
    for (let i = 0; i < boxes.length; i += 1) {
      expect(distanceToCentre(boxes[i])).toBeGreaterThanOrEqual(discRadius);
      for (let j = i + 1; j < boxes.length; j += 1) expect(apart(boxes[i], boxes[j])).toBe(true);
    }
    // The frame is computed after the labels have moved: it holds every box.
    for (const [x0, y0, x1, y1] of boxes) {
      expect(x0).toBeGreaterThanOrEqual(bounds.x);
      expect(x1).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(y0).toBeGreaterThanOrEqual(bounds.y);
      expect(y1).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    // ... and it grew to hold the labels that were pushed past the circle's own frame.
    expect(bounds.y + bounds.height).toBeGreaterThan(NOVA.cy + NOVA.R + 6);
    // The text moved with its box: the title sits 20 px under the top, the last line 4 px over the bottom.
    for (const label of labels) {
      expect(label.lines[0].y).toBeCloseTo(label.box[1] + 20, 6);
      expect(label.lines[label.lines.length - 1].y).toBeCloseTo(label.box[3] - 4, 6);
    }
  });

  // What the nine-claim payload comes to, pinned so that the backend's wheel can be held to the same
  // numbers: the reference top of each label (before any push), its final box, and its leader line
  // (start on the rim at R + 6, end on the box) when it moved more than 12 px.
  type Placement = { ref: number; box: NovaLabel['box']; leader?: [number, number, number, number] };
  const pinned: Record<string, Placement> = {
    'Claim 1 long name xx': { ref: 179.0, box: [380.0, 179.0, 620.0, 221.0] },
    'Claim 2 long name xx': {
      ref: 565.5,
      box: [750.0, 780.49, 990.0, 822.49],
      leader: [835.19, 578.26, 835.19, 780.49],
    },
    'Claim 3 long name xx': { ref: 892.85, box: [434.05, 892.85, 674.05, 934.85] },
    'Claim 4 long name xx': { ref: 844.8, box: [74.99, 844.8, 314.99, 886.8] },
    'Claim 5 long name xx': { ref: 801.73, box: [18.39, 801.73, 258.39, 843.73] },
    'Claim 6 long name xx': {
      ref: 749.89,
      box: [10.0, 890.8, 250.0, 932.8],
      leader: [227.35, 751.37, 227.35, 890.8],
    },
    'Claim 7 long name xx': {
      ref: 692.05,
      box: [10.0, 936.8, 250.0, 978.8],
      leader: [195.23, 696.47, 195.23, 936.8],
    },
    'Claim 8 long name xx': {
      ref: 628.87,
      box: [10.0, 982.8, 250.0, 1024.8],
      leader: [174.52, 638.4, 174.52, 982.8],
    },
    'Claim 9 long name xx': {
      ref: 566.79,
      box: [10.0, 1028.8, 250.0, 1070.8],
      leader: [164.89, 579.48, 164.89, 1028.8],
    },
    'Not linked to a claim': {
      ref: 418.71,
      box: [10.0, 274.67, 262.0, 316.67],
      leader: [181.99, 446.52, 181.99, 316.67],
    },
  };

  it('pins the nine-claim placement and ties every label that moved more than 12 px to its sector', () => {
    const { labels, bands } = layoutNova(nine, { seed: 'nine' });
    expect(labels).toHaveLength(Object.keys(pinned).length);
    const close = (actual: number[], expected: number[]) =>
      expected.forEach((value, k) => expect(actual[k]).toBeCloseTo(value, 1));

    for (const label of labels) {
      const band = bands.find((b) => b.key === label.bandKey)!;
      const want = pinned[band.name];
      expect(want).toBeDefined();
      close(label.box, want.box);

      const moved = Math.abs(label.box[1] - want.ref) > 12;
      expect(label.leader !== undefined).toBe(moved);
      expect(Boolean(want.leader)).toBe(moved);
      if (!label.leader || !want.leader) continue;
      const { x1, y1, x2, y2 } = label.leader;
      close([x1, y1, x2, y2], want.leader);
      // It starts on the rim at R + 6, on the sector's mid angle ...
      const [sx, sy] = polar(NOVA.R + 6, band.mid);
      expect(x1).toBeCloseTo(sx, 6);
      expect(y1).toBeCloseTo(sy, 6);
      expect(Math.hypot(x1 - NOVA.cx, y1 - NOVA.cy)).toBeCloseTo(NOVA.R + 6, 6);
      // ... and ends on the nearest point of the label's box, which is on its edge here.
      const [bx0, by0, bx1, by1] = label.box;
      expect(x2).toBeCloseTo(Math.min(Math.max(x1, bx0), bx1), 6);
      expect(y2).toBeCloseTo(Math.min(Math.max(y1, by0), by1), 6);
      expect(x2 === bx0 || x2 === bx1 || y2 === by0 || y2 === by1).toBe(true);
    }
    expect(labels.filter((l) => l.leader)).toHaveLength(6);
  });

  const labelAt = (box: NovaLabel['box']): NovaLabel => ({
    bandKey: 'x',
    anchor: 'middle',
    lines: [{ text: 'x', x: (box[0] + box[2]) / 2, y: box[1] + 20, size: 21, weight: 600, fill: '#000' }],
    box,
  });

  it('pushes a label off the disc by the overlap height + 4 px, away from the centre', () => {
    const half = Math.sqrt(discRadius ** 2 - 50 ** 2); // the disc's half-height over the box's nearest column
    const below = labelAt([NOVA.cx + 50, NOVA.cy + 10, NOVA.cx + 150, NOVA.cy + 50]);
    const above = labelAt([NOVA.cx + 50, NOVA.cy - 50, NOVA.cx + 150, NOVA.cy - 10]);
    resolveLabelOverlaps([below, above]);
    expect(below.box[1]).toBeCloseTo(NOVA.cy + half + 4, 6);
    expect(below.box[3] - below.box[1]).toBe(40);
    expect(below.lines[0].y).toBeCloseTo(below.box[1] + 20, 6);
    expect(above.box[3]).toBeCloseTo(NOVA.cy - half - 4, 6);
    expect(above.lines[0].y).toBeCloseTo(above.box[1] + 20, 6);
    expect(distanceToCentre(below.box)).toBeGreaterThanOrEqual(discRadius);
    expect(distanceToCentre(above.box)).toBeGreaterThanOrEqual(discRadius);
  });

  it('deals with the earlier label before the disc: the order shows in a 4 px window', () => {
    // `first` stands just beyond the disc's width and ends 2 px inside the chord of the disc over the
    // second label's column; `second` hits `first` and the disc. Past `first` + 4 px it is clear of
    // the disc (top = chord end + 2), so a second push never happens. Had the disc come first, the
    // label would stop at the chord end + 4, and `first` would never matter.
    const half = Math.sqrt(discRadius ** 2 - 300 ** 2); // the disc's half-height over x = cx + 300
    const first = labelAt([NOVA.cx + 340, NOVA.cy + 100, NOVA.cx + 460, NOVA.cy + half - 2]);
    const second = labelAt([NOVA.cx + 300, NOVA.cy + 120, NOVA.cx + 420, NOVA.cy + 160]);
    const firstBox = [...first.box];
    resolveLabelOverlaps([first, second]);
    expect(first.box).toEqual(firstBox);
    expect(second.box[0]).toBe(NOVA.cx + 300);
    expect(second.box[2]).toBe(NOVA.cx + 420);
    expect(second.box[1]).toBeCloseTo(NOVA.cy + half + 2, 6); // = first's bottom + 4
    expect(second.box[3]).toBeCloseTo(NOVA.cy + half + 42, 6);
    expect(second.lines[0].y).toBeCloseTo(second.box[1] + 20, 6);
    expect(apart(first.box, second.box)).toBe(true);
    expect(distanceToCentre(second.box)).toBeGreaterThanOrEqual(discRadius);
  });

  it('leaves a label that touches nothing where it is, tangent to the disc included', () => {
    const tangent = labelAt([NOVA.cx - 60, NOVA.cy - discRadius - 42, NOVA.cx + 60, NOVA.cy - discRadius]);
    const far = labelAt([NOVA.cx + discRadius + 10, NOVA.cy - 20, NOVA.cx + discRadius + 130, NOVA.cy + 20]);
    const before = [tangent.box, far.box].map((b) => [...b]);
    resolveLabelOverlaps([tangent, far]);
    expect([tangent.box, far.box]).toEqual(before);
  });
});

describe('formatting and colours', () => {
  it('formats p like the reference', () => {
    expect(formatP(1.30103)).toBe('p = 0.050');
    expect(formatP(15.2649)).toBe('p = 5×10⁻¹⁶');
    expect(formatP(4)).toBe('p = 1×10⁻⁴');
  });

  it('labels p as adjusted for a term and combined for a sub-group', () => {
    expect(formatP(2, 'adjusted')).toBe('adj. p = 0.010');
    expect(formatP(2, 'combined')).toBe('combined p = 0.010');
    expect(formatP(15.2649, 'combined')).toBe('combined p = 5×10⁻¹⁶');
  });

  it('pluralises the label, omits "· 0 against" and counts balanced sub-groups', () => {
    expect(subgroupsFor({ n_for: 5, n_against: 0 })).toBe('5 sub-groups for');
    expect(subgroupsFor({ n_for: 1, n_against: 2 })).toBe('1 sub-group for · 2 against');
    expect(subgroupsFor({ n_for: 1, n_against: 1, n_balanced: 1 })).toBe('1 sub-group for · 1 against · 1 balanced');
    expect(subgroupsFor({ n_for: 2, n_against: 0, n_balanced: 3 })).toBe('2 sub-groups for · 3 balanced');
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
