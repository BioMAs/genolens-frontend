import { scaleSqrt } from 'd3';
import type { CosmOmicsNovaData, NovaClaim, NovaSubgroup, NovaTerm } from '@/types/cosmomics';
import { NOVA_INK, balanceColor, claimColor, hashString, type ClaimColor } from './novaPalette';

/**
 * Geometry of the CosmOmics Pathway Nova — a pure function of the payload.
 *
 * Ported from the reference implementation
 * (docs/reference/cosmomics/cosmomics_pathway_nova.py, `nova()`), same constants
 * and same coordinate frame (centre 500,555, radius 330), so the reference SVG
 * can be compared to this layout number for number. The only difference is the
 * random stream: angular jitter and decorative dust come from a generator seeded
 * with the dataset id, so a given dataset always renders the same picture.
 */

export const NOVA = {
  cx: 500,
  cy: 555,
  R: 330,
  gap: 2,
  otherWidth: 36,
  coreRadius: 26,
  width: 1000,
  labelFont: 21,
  subLabelFont: 12.5,
} as const;

const DEG = Math.PI / 180;

/**
 * The "not linked" sector is a fixed 36° slice. On real data it can receive hundreds of
 * significant pathways, some grouping dozens of terms: draw the strongest few, keep their
 * bubbles below the largest claim bubble of the reference, and their dots readable.
 */
const UNLINKED_DRAWN = 12;
const UNLINKED_TERMS_DRAWN = 8;
const UNLINKED_MAX_BUBBLE = 9;

// ── Seeded randomness ───────────────────────────────────────────────────────

/** mulberry32: small, fast, good enough for jitter. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRandom {
  random: () => number;
  uniform: (a: number, b: number) => number;
  normal: (mean: number, sd: number) => number;
}

export function seededRandom(seed: string): SeededRandom {
  const random = mulberry32(hashString(seed));
  return {
    random,
    uniform: (a, b) => a + (b - a) * random(),
    normal: (mean, sd) => {
      // Box–Muller; 1 − u keeps the log away from 0.
      const u = 1 - random();
      const v = random();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** "p = 0.012" below 10⁻³, "p = 5×10⁻¹⁶" beyond — as in the reference. */
export function formatP(nl: number): string {
  if (nl < 3) return `p = ${(10 ** -nl).toFixed(3)}`;
  let e = Math.ceil(nl);
  let m = Math.round(10 ** (e - nl));
  if (m >= 10) {
    m = 1;
    e -= 1;
  }
  const exp = `-${e}`.split('').map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
  return `p = ${m}×10${exp}`;
}

export function pathwaysFor(claim: Pick<NovaClaim, 'n_for' | 'n_against'>): string {
  const n = claim.n_for;
  const base = `${n} pathway${n === 1 ? '' : 's'} for`;
  return claim.n_against ? `${base} · ${claim.n_against} against` : base;
}

// ── Layout types ────────────────────────────────────────────────────────────

export interface NovaBand {
  key: string;
  kind: 'claim' | 'other';
  name: string;
  claim?: NovaClaim;
  color: ClaimColor;
  /** Degrees, clockwise from 3 o'clock. Solid part start→split, hatched split→end. */
  start: number;
  split: number;
  end: number;
  mid: number;
}

export interface NovaTermDot {
  key: string;
  x: number;
  y: number;
  r: number;
  fill: string;
  opacity: number;
  term: NovaTerm;
}

export interface NovaBubble {
  key: string;
  bandKey: string;
  claimName: string | null;
  subgroup: NovaSubgroup;
  angle: number;
  radius: number;
  x: number;
  y: number;
  r: number;
  fill: string;
  terms: NovaTermDot[];
}

export interface NovaRing {
  key: string;
  r: number;
  kind: 'threshold' | 'tick';
  /** "p = 0.05", or "10" for a 10⁻ⁿ tick (exponent apart). */
  label: string;
  exponent?: number;
  labelX: number;
  labelY: number;
}

export interface NovaLabelLine {
  text: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  fill: string;
}

export interface NovaLabel {
  bandKey: string;
  anchor: 'start' | 'middle' | 'end';
  lines: NovaLabelLine[];
  box: [number, number, number, number];
}

export interface NovaDustLayer {
  fill: string;
  opacity: number;
  /** All dots of one colour as a single path: thousands of dots, one DOM node. */
  d: string;
}

export interface NovaLayout {
  cap: number;
  bands: NovaBand[];
  rings: NovaRing[];
  dust: NovaDustLayer[];
  bubbles: NovaBubble[];
  labels: NovaLabel[];
  /** Tight frame around the circle and every label. */
  bounds: { x: number; y: number; width: number; height: number };
  condition: string;
}

export interface NovaLayoutOptions {
  /** Seed of every random position: the dataset id (plus comparison). */
  seed: string;
  showDust?: boolean;
  /** Terms at p < alpha are drawn opaque. */
  alpha?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function polar(r: number, angle: number): [number, number] {
  return [NOVA.cx + r * Math.cos(angle * DEG), NOVA.cy + r * Math.sin(angle * DEG)];
}

export function wedgePath(t1: number, t2: number, r: number): string {
  const [x1, y1] = polar(r, t1);
  const [x2, y2] = polar(r, t2);
  const large = t2 - t1 > 180 ? 1 : 0;
  return `M${NOVA.cx},${NOVA.cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
}

export function arcPath(t1: number, t2: number, r: number): string {
  const [x1, y1] = polar(r, t1);
  const [x2, y2] = polar(r, t2);
  const large = t2 - t1 > 180 ? 1 : 0;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** Bubble radius from |S_pro − S_anti|. */
export function bubbleSize(delta: number): number {
  return 3.2 + 1.9 * Math.sqrt(Math.abs(delta));
}

export function termDotSize(nl: number): number {
  return 0.9 + 0.45 * Math.sqrt(Math.max(nl, 0));
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

// ── Layout ──────────────────────────────────────────────────────────────────

export function layoutNova(data: CosmOmicsNovaData, options: NovaLayoutOptions): NovaLayout {
  const { cx, cy, R, gap, otherWidth } = NOVA;
  const alpha = options.alpha ?? data.alpha ?? 0.05;
  const sigNl = -Math.log10(alpha);
  const claims = [...data.claims].sort((a, b) => b.s_pro - a.s_pro);
  const unlinked = data.unlinked ?? [];

  // Radial scale: further out = more significant, capped just past the best sub-group.
  const best = claims.map((c) => c.best_nl ?? Math.max(0, ...c.subgroups.map((s) => s.nl)));
  const fallback = Math.max(2, ...unlinked.map((s) => s.nl));
  const cap = 1.04 * (best.length ? Math.max(...best) : fallback);
  const rad = scaleSqrt().domain([0, cap]).range([30, R - 10]).clamp(true);

  // Sectors: width ∝ importance, no floor, first one centred at 12 o'clock.
  const bands: NovaBand[] = [];
  const total = claims.reduce((sum, c) => sum + (c.s_pro + c.s_anti), 0);
  const avail = 360 - otherWidth - gap * (claims.length + 1);
  const k = total > 0 ? avail / total : 0;
  let a0 = -90 - (claims.length ? (k * (claims[0].s_pro + claims[0].s_anti)) / 2 : otherWidth / 2);
  claims.forEach((claim) => {
    const wa = claim.s_pro * k;
    const wc = claim.s_anti * k;
    bands.push({
      key: `claim:${claim.name}`,
      kind: 'claim',
      name: claim.name,
      claim,
      color: claimColor(claim.name),
      start: a0,
      split: a0 + wa,
      end: a0 + wa + wc,
      mid: a0 + (wa + wc) / 2,
    });
    a0 += wa + wc + gap;
  });
  const other: NovaBand = {
    key: 'other',
    kind: 'other',
    name: 'Not linked to a claim',
    color: { fill: NOVA_INK.against, text: NOVA_INK.againstText },
    start: a0,
    split: a0 + otherWidth - gap,
    end: a0 + otherWidth - gap,
    mid: a0 + (otherWidth - gap) / 2,
  };
  bands.push(other);

  // Decorative dust below the p = 0.05 ring, in each claim's colour.
  const dust: NovaDustLayer[] = [];
  if (options.showDust ?? true) {
    const rng = seededRandom(`${options.seed}:dust`);
    const inner = rad(1.3);
    for (const band of bands) {
      const n = Math.floor(9 * (band.end - band.start));
      const parts: string[] = [];
      for (let i = 0; i < n; i += 1) {
        const rr = Math.abs(30 + (inner - 30) * rng.random() ** 0.7 + rng.normal(0, 6));
        const [x, y] = polar(rr, rng.uniform(band.start, band.end));
        parts.push(`M${(x - 0.7).toFixed(1)},${y.toFixed(1)}a.7,.7 0 1,0 1.4,0a.7,.7 0 1,0 -1.4,0`);
      }
      dust.push({
        fill: band.kind === 'claim' ? band.color.text : NOVA_INK.against,
        opacity: band.kind === 'claim' ? 0.3 : 0.16,
        d: parts.join(''),
      });
    }
  }

  // Significance rings, labelled inside the "not linked" sector.
  const rings: NovaRing[] = [];
  const threshold = rad(-Math.log10(0.05));
  const [tx, ty] = polar(threshold, other.mid);
  rings.push({ key: 'p05', r: threshold, kind: 'threshold', label: 'p = 0.05', labelX: tx, labelY: ty + 4 });
  for (const e of [5, 10]) {
    if (e >= cap * 0.97) continue;
    const r = rad(e);
    const [lx, ly] = polar(r, other.mid);
    rings.push({ key: `e${e}`, r, kind: 'tick', label: '10', exponent: e, labelX: lx, labelY: ly + 4 });
  }

  // Sub-group bubbles and their terms.
  const rng = seededRandom(`${options.seed}:place`);
  const place = (subs: NovaSubgroup[], t1: number, t2: number): Array<[NovaSubgroup, number]> => {
    if (!subs.length) return [];
    const pad = Math.min(2, (t2 - t1) * 0.12);
    const lo = t1 + pad;
    const hi = t2 - pad;
    const order = [...subs].sort((a, b) => b.nl - a.nl || a.name.localeCompare(b.name));
    const slots =
      order.length > 1
        ? order.map((_, i) => lo + ((hi - lo) * (i + 1)) / (order.length + 1))
        : [(lo + hi) / 2];
    // Strong and weak alternate: slots take ranks 0, 2, 4, … then 1, 3, 5, …
    const idx = order.map((_, i) => i).sort((a, b) => (a % 2) - (b % 2) || a - b);
    return idx.map((i, slot) => [order[i], slots[slot] + rng.normal(0, 0.25)]);
  };

  const bubbles: NovaBubble[] = [];
  for (const band of bands) {
    let items: Array<[NovaSubgroup, number]>;
    if (band.kind === 'other') {
      const strongest = [...unlinked].sort((a, b) => b.nl - a.nl).slice(0, UNLINKED_DRAWN);
      items = place(strongest, band.start, band.end);
    } else {
      const subs = band.claim!.subgroups;
      const against = subs.filter((s) => s.delta <= 0);
      items = place(subs.filter((s) => s.delta > 0), band.start, band.split);
      items = items.concat(
        band.end - band.split > 3 ? place(against, band.split, band.end) : place(against, band.start, band.end),
      );
    }
    for (const [sub, angle] of items) {
      const radius = rad(sub.nl);
      const [x, y] = polar(radius, angle);
      const isClaim = band.kind === 'claim';
      const key = `${band.key}|${sub.name}`;
      const drawnTerms = isClaim
        ? sub.terms
        : [...sub.terms].sort((a, b) => b.nl - a.nl).slice(0, UNLINKED_TERMS_DRAWN);
      const terms: NovaTermDot[] = drawnTerms.map((term, i) => {
        const [px, py] = polar(rad(term.nl) + rng.normal(0, 1.5), angle + rng.normal(0, 0.9));
        const fill = term.effect === 0 ? NOVA_INK.against : term.effect > 0 ? NOVA_INK.green : NOVA_INK.coral;
        return {
          key: `${key}|${term.id}|${term.obs}|${i}`,
          x: px,
          y: py,
          r: termDotSize(term.nl),
          fill,
          opacity: term.nl > sigNl ? 0.85 : 0.4,
          term,
        };
      });
      bubbles.push({
        key,
        bandKey: band.key,
        claimName: isClaim ? band.name : null,
        subgroup: sub,
        angle,
        radius,
        x,
        y,
        r: isClaim
          ? bubbleSize(sub.delta)
          : Math.min(bubbleSize(sub.terms.reduce((sum, t) => sum + t.nl, 0)) * 0.7, UNLINKED_MAX_BUBBLE),
        fill: isClaim ? balanceColor(sub.balance) : NOVA_INK.against,
        terms,
      });
    }
  }

  // Claim labels outside the circle (reference `lab()`), then de-overlapped.
  const labels: NovaLabel[] = [];
  const makeLabel = (band: NovaBand, title: string, sub: string, titleFill: string, subFill: string) => {
    const Rl = R + 24;
    let [x, y] = polar(Rl, band.mid);
    const ca = Math.cos(band.mid * DEG);
    const sa = Math.sin(band.mid * DEG);
    const anchor: NovaLabel['anchor'] = Math.abs(ca) < 0.3 ? 'middle' : ca > 0 ? 'start' : 'end';
    y += sa > 0.3 ? 8 : sa < -0.3 ? -2 : 6;
    const titleW = title.length * 12.0;
    const w = Math.max(titleW, sub.length * 6.3);
    if (anchor === 'start' && x + w > 990) x = 990 - w;
    if (anchor === 'end' && x - w < 10) x = 10 + w;
    let lines = [sub];
    let subW = sub.length * 6.3;
    if (anchor !== 'middle' && sub.includes(' · ')) {
      const edge = anchor === 'start' ? cx + R + 6 : cx - R - 6;
      if ((anchor === 'start' && x < edge) || (anchor === 'end' && x > edge)) {
        // The second line would spill over the disc: break it in two.
        lines = sub.split(' · ');
        subW = Math.max(...lines.map((l) => l.length)) * 6.3;
        x = anchor === 'start' ? Math.max(edge, x) : Math.min(edge, x);
        x = anchor === 'start' ? Math.min(x, 990 - Math.max(titleW, subW)) : Math.max(x, 10 + Math.max(titleW, subW));
      }
    }
    const width = Math.max(titleW, subW);
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    const out: NovaLabelLine[] = [
      { text: title, x, y, size: NOVA.labelFont, weight: 600, fill: titleFill },
      ...lines.map((text, j) => ({
        text,
        x,
        y: y + 18 + 16 * j,
        size: NOVA.subLabelFont,
        weight: 500,
        fill: subFill,
      })),
    ];
    labels.push({
      bandKey: band.key,
      anchor,
      lines: out,
      box: [x0, y - 20, x0 + width, y + 18 + 16 * (lines.length - 1) + 4],
    });
  };
  for (const band of bands) {
    if (band.kind === 'claim') {
      makeLabel(band, band.name, pathwaysFor(band.claim!), band.color.text, NOVA_INK.muted);
    } else {
      const n = data.unlinked_total ?? unlinked.length;
      makeLabel(band, band.name, `${n} pathway${n === 1 ? '' : 's'}`, NOVA_INK.againstText, NOVA_INK.againstText);
    }
  }
  resolveLabelOverlaps(labels);

  // Frame: the circle plus every label, with a small margin.
  let [minX, minY, maxX, maxY] = [cx - R - 6, cy - R - 6, cx + R + 6, cy + R + 6];
  for (const label of labels) {
    minX = Math.min(minX, label.box[0]);
    minY = Math.min(minY, label.box[1]);
    maxX = Math.max(maxX, label.box[2]);
    maxY = Math.max(maxY, label.box[3]);
  }
  const margin = 8;
  const left = Math.min(0, minX - margin);
  const bounds = {
    x: left,
    y: minY - margin,
    width: Math.max(NOVA.width, maxX + margin) - left,
    height: maxY - minY + 2 * margin,
  };

  return {
    cap,
    bands,
    rings,
    dust,
    bubbles,
    labels,
    bounds,
    condition: data.condition || 'Active',
  };
}

/**
 * Many narrow sectors can stack their labels on one another. Push each label that
 * hits an earlier one vertically away from the centre until it is clear; labels
 * that already stand free (the reference case) keep their reference position.
 */
export function resolveLabelOverlaps(labels: NovaLabel[]): void {
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const centreY = (label.box[1] + label.box[3]) / 2;
    const dir = centreY >= NOVA.cy ? 1 : -1;
    for (let guard = 0; guard < 40; guard += 1) {
      const hit = labels.slice(0, i).find((other) => overlaps(label.box, other.box));
      if (!hit) break;
      const shift = dir > 0 ? hit.box[3] - label.box[1] + 4 : hit.box[1] - label.box[3] - 4;
      label.box = [label.box[0], label.box[1] + shift, label.box[2], label.box[3] + shift];
      label.lines = label.lines.map((line) => ({ ...line, y: line.y + shift }));
    }
  }
}
