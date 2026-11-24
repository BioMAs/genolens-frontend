/**
 * WCAG 2.x contrast helpers for design tokens written as hex or `oklch(L% C H)`.
 *
 * `parseColor` returns gamma-encoded sRGB channels in 0-1. It throws on any
 * unsupported input rather than falling back to black, so a typo in a token
 * fails a contrast test loudly instead of passing silently.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const OKLCH_RE = new RegExp(
  `^oklch\\(\\s*(${NUM})%\\s+(${NUM})\\s+(${NUM})(?:\\s*/\\s*${NUM}%?)?\\s*\\)$`,
  'i',
);

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Linear-light channel -> gamma-encoded sRGB (sRGB transfer function). */
function encodeSrgb(linear: number): number {
  const c = clamp01(linear);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Gamma-encoded sRGB channel -> linear light. */
function decodeSrgb(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function parseHex(digits: string): Rgb {
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

/** OKLCH (L in 0-1, C, h in degrees) -> gamma-encoded sRGB, via Ottosson's OKLab matrices. */
function oklchToSrgb(lightness: number, chroma: number, hueDeg: number): Rgb {
  const hue = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);

  return {
    r: encodeSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encodeSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encodeSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/**
 * Accepts `#rgb`, `#rrggbb`, `oklch(L% C H)` and `oklch(L% C H / a)` (alpha ignored).
 * Returns gamma-encoded sRGB in 0-1. Throws on anything else.
 */
export function parseColor(value: string): Rgb {
  const input = typeof value === 'string' ? value.trim() : '';

  const hex = HEX_RE.exec(input);
  if (hex) return parseHex(hex[1]);

  const oklch = OKLCH_RE.exec(input);
  if (oklch) {
    return oklchToSrgb(parseFloat(oklch[1]) / 100, parseFloat(oklch[2]), parseFloat(oklch[3]));
  }

  throw new Error(
    `Unsupported colour ${JSON.stringify(value)}: expected #rgb, #rrggbb, oklch(L% C H) or oklch(L% C H / a)`,
  );
}

/** WCAG 2.x relative luminance of a colour string. */
function relativeLuminance(value: string): number {
  const { r, g, b } = parseColor(value);
  return 0.2126 * decodeSrgb(r) + 0.7152 * decodeSrgb(g) + 0.0722 * decodeSrgb(b);
}

/** WCAG 2.x contrast ratio, (L_lighter + 0.05) / (L_darker + 0.05), between 1 and 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
