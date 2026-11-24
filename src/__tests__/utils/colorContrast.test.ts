import { contrastRatio, parseColor } from '@/utils/colorContrast';

it('black on white is 21', () => expect(contrastRatio('#000', '#ffffff')).toBeCloseTo(21, 1));
it('logo plum on white', () => expect(contrastRatio('#494270', '#fff')).toBeCloseTo(9.15, 1));
it('reads oklch white and black', () =>
  expect(contrastRatio('oklch(100% 0 0)', 'oklch(0% 0 0)')).toBeCloseTo(21, 0));
it('oklch logo lagoon is close to #69b9a8', () => {
  const c = parseColor('oklch(73% 0.075 175)');
  expect(Math.round(c.r * 255)).toBeGreaterThan(95); expect(Math.round(c.g * 255)).toBeGreaterThan(175);
});

describe('parseColor', () => {
  it('expands #rgb to #rrggbb', () => {
    expect(parseColor('#fa0')).toEqual(parseColor('#ffaa00'));
  });

  it('returns gamma-encoded sRGB in 0-1 for hex', () => {
    const c = parseColor('#ff8000');
    expect(c.r).toBeCloseTo(1, 10);
    expect(c.g).toBeCloseTo(128 / 255, 10);
    expect(c.b).toBeCloseTo(0, 10);
  });

  it('ignores the alpha channel of oklch(L% C H / a)', () => {
    expect(parseColor('oklch(50% 0.1 200 / 0.5)')).toEqual(parseColor('oklch(50% 0.1 200)'));
    expect(parseColor('oklch(50% 0.1 200 / 40%)')).toEqual(parseColor('oklch(50% 0.1 200)'));
  });

  it('reads a near-white token such as oklch(98.4% 0.005 185)', () => {
    const c = parseColor('oklch(98.4% 0.005 185)');
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThan(0.9);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('maps oklch achromatic extremes to pure black and white', () => {
    expect(parseColor('oklch(0% 0 0)')).toEqual({ r: 0, g: 0, b: 0 });
    const w = parseColor('oklch(100% 0 0)');
    expect(w.r).toBeCloseTo(1, 4);
    expect(w.g).toBeCloseTo(1, 4);
    expect(w.b).toBeCloseTo(1, 4);
  });

  it('clamps out-of-gamut oklch into [0,1]', () => {
    const c = parseColor('oklch(70% 0.4 150)');
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it.each(['', 'red', 'rgb(0, 0, 0)', '#12', '#12345', '#gggggg', 'oklch(abc)', 'oklch(50% 0.1)', 'oklch(0.5 0.1 200)'])(
    'throws a clear error on %j',
    (value) => {
      expect(() => parseColor(value)).toThrow(/Unsupported colour/);
    },
  );
});

describe('contrastRatio', () => {
  it('is symmetric (lighter always on top)', () => {
    expect(contrastRatio('#494270', '#fff')).toBeCloseTo(contrastRatio('#fff', '#494270'), 10);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#69b9a8', '#69b9a8')).toBeCloseTo(1, 10);
  });

  it('agrees between hex and oklch spellings of the same colour', () => {
    expect(contrastRatio('oklch(0% 0 0)', '#fff')).toBeCloseTo(contrastRatio('#000', '#fff'), 1);
  });
});
