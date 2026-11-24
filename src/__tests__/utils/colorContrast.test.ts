import { contrastRatio, parseColor, toLegacyColor } from '@/utils/colorContrast';

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

describe('toLegacyColor', () => {
  // Plotly (tinycolor) et cytoscape ne lisent pas oklch() : lui donner la valeur
  // calculee d'un jeton revenait a peindre ses traits et son texte avec la couleur
  // par defaut de la bibliotheque (des quadrillages blancs en theme sombre).
  it('writes oklch as an rgb() literal', () => {
    expect(toLegacyColor('oklch(100% 0 0)')).toBe('rgb(255, 255, 255)');
    expect(toLegacyColor('oklch(0% 0 0)')).toBe('rgb(0, 0, 0)');
    expect(toLegacyColor(' oklch(25% 0.05 292) ')).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
  });

  it('keeps the alpha channel as rgba()', () => {
    expect(toLegacyColor('oklch(100% 0 0 / 0.5)')).toBe('rgba(255, 255, 255, 0.5)');
    expect(toLegacyColor('oklch(100% 0 0 / 25%)')).toBe('rgba(255, 255, 255, 0.25)');
  });

  it('leaves every other form untouched', () => {
    for (const v of ['#4f46e5', 'rgb(1, 2, 3)', 'rgba(15, 157, 107, 0.2)', 'red', '']) {
      expect(toLegacyColor(v)).toBe(v);
    }
  });

  it('returns an empty string for an oklch it cannot read, so the caller falls back', () => {
    expect(toLegacyColor('oklch(0.5 0.1 200)')).toBe('');
  });
});

describe('toLegacyColor — the other CSS Color 4 spellings', () => {
  // Le pipeline CSS de Next (Lightning CSS) peut reecrire oklch() en lab() : c'est ce que
  // getComputedStyle rend alors pour un jeton. On laisse le navigateur le convertir, en peignant
  // un pixel. jsdom n'a pas de canvas : on en simule un.
  function stubCanvas(pixel: number[] | null) {
    let fill = '#010203';
    const ctx = {
      get fillStyle() {
        return fill;
      },
      set fillStyle(v: string) {
        // Comme un vrai canvas : une valeur illisible laisse l'ancienne en place.
        if (/^(lab|lch|oklab|oklch|color)\(/i.test(v) && !v.includes('bogus')) fill = v;
        else if (/^#[0-9a-f]{6}$/i.test(v)) fill = v;
      },
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      getImageData: jest.fn(() => ({ data: Uint8ClampedArray.from(pixel ?? [0, 0, 0, 0]) })),
    };
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue((pixel ? ctx : null) as never);
  }

  afterEach(() => jest.restoreAllMocks());

  it('reads a lab() through a canvas pixel', () => {
    stubCanvas([24, 29, 40, 255]);
    expect(toLegacyColor('lab(18.6621% 1.54962 -5.39682)')).toBe('rgb(24, 29, 40)');
  });

  it('keeps a partial alpha', () => {
    stubCanvas([24, 29, 40, 128]);
    expect(toLegacyColor('lab(18.6621% 1.54962 -5.39682 / 0.5)')).toBe('rgba(24, 29, 40, 0.502)');
  });

  it('reads the number form oklch(0.57 0.16 38) through the canvas instead of dropping it', () => {
    // Une ecriture valide en CSS, que parseColor refuse (il exige `L%`) : elle ne doit pas se perdre en
    // '' silencieux, le navigateur sait la lire. Les jetons du projet sont en `L%`, un jeton venu d'ailleurs
    // (extension de theme, valeur calculee par un outil) peut ne pas l'etre.
    stubCanvas([200, 90, 60, 255]);
    expect(toLegacyColor('oklch(0.57 0.16 38)')).toBe('rgb(200, 90, 60)');
    expect(toLegacyColor('oklch(57% 0.16 38deg)')).toBe('rgb(200, 90, 60)');
  });

  it('still gives an empty string for an unreadable oklch when the canvas cannot read it either', () => {
    stubCanvas(null);
    expect(toLegacyColor('oklch(0.57 0.16 38)')).toBe('');
    stubCanvas([200, 90, 60, 255]);
    expect(toLegacyColor('oklch(bogus)')).toBe('');
  });

  it('gives an empty string for a colour the browser rejects', () => {
    stubCanvas([24, 29, 40, 255]);
    expect(toLegacyColor('lab(bogus)')).toBe('');
  });

  it('gives an empty string when there is no 2d context (jsdom, SSR)', () => {
    stubCanvas(null);
    expect(toLegacyColor('lab(18.6621% 1.54962 -5.39682)')).toBe('');
  });
});
