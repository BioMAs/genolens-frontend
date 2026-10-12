/**
 * CosmOmics colours — SciLicium charter (docs/reference/cosmomics/Scilicium_colors_website_v3.svg).
 *
 * The nova is a figure with its own light background in both app themes: the
 * reference grammar (white label halos, pale sector tints) only reads on white.
 */

export const NOVA_INK = {
  green: '#34B596', // term / sub-group FOR the claim
  coral: '#FF5F5F', // term / sub-group AGAINST the claim
  neutral: '#C9D1D9', // balanced sub-group
  against: '#9AA8B6', // hatched-part rim, not-linked bubbles
  againstText: '#7D8B9C',
  hatchFill: '#EEF1F4',
  hatchLine: '#B9C3CC',
  muted: '#384C65',
  ink: '#3A4150',
  core: '#0B2A3E',
  background: '#FFFFFF',
} as const;

export interface ClaimColor {
  /** Sector tint and rim. */
  fill: string;
  /** Claim name. */
  text: string;
}

/** Fixed colour per claim name, so a claim keeps its colour from one dataset to the next. */
const FIXED: Record<string, ClaimColor> = {
  Firming: { fill: '#158394', text: '#158394' },
  Barrier: { fill: '#47BDD7', text: '#2A6478' },
  Regeneration: { fill: '#FEC601', text: '#CA9A00' },
  'Anti-ageing': { fill: '#5D5892', text: '#5D5892' },
  Soothing: { fill: '#C9ADA7', text: '#9C7B74' },
  Antioxidant: { fill: '#364B44', text: '#364B44' },
  // The next two charter colours, in order, for the other claims GenoLens knows.
  Energising: { fill: '#33A8E3', text: '#0086BE' },
  'Anti-wrinkles': { fill: '#5D309C', text: '#5D309C' },
};

/** Charter colours for any further claim: readable on white, never green nor red. */
const FALLBACK: ClaimColor[] = [
  { fill: '#30415F', text: '#30415F' },
  { fill: '#B78A00', text: '#8A6500' },
  { fill: '#006095', text: '#006095' },
  { fill: '#C6B7DC', text: '#5D5892' },
  { fill: '#2E4857', text: '#2E4857' },
  { fill: '#66B8E1', text: '#00659B' },
  { fill: '#825C00', text: '#825C00' },
];

/** djb2 — stable across sessions, so a fallback colour sticks to its claim name. */
export function hashString(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  return h;
}

export function claimColor(name: string): ClaimColor {
  return FIXED[name] ?? FALLBACK[hashString(name) % FALLBACK.length];
}

const RAMP = {
  coral: [0xff, 0x5f, 0x5f],
  neutral: [0xc9, 0xd1, 0xd9],
  green: [0x34, 0xb5, 0x96],
} as const;

/** Python's round(): halves go to the even neighbour. Keeps the hex identical to the reference. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/**
 * Sub-group colour from its balance pro/anti: −1 coral → 0 grey → +1 green.
 * The reference script's piecewise-linear ramp, same arithmetic and rounding,
 * so a given balance gets exactly the reference hex.
 */
export function balanceColor(balance: number): string {
  const t = (Math.max(-1, Math.min(1, balance)) + 1) / 2;
  const [lo, hi, f] =
    t < 0.5 ? [RAMP.coral, RAMP.neutral, t / 0.5] : [RAMP.neutral, RAMP.green, (t - 0.5) / 0.5];
  const hex = lo.map((v, i) => roundHalfEven(v + (hi[i] - v) * f).toString(16).padStart(2, '0'));
  return `#${hex.join('')}`.toUpperCase();
}
