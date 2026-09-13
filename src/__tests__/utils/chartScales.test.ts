import {
  sequentialScale,
  divergingScale,
  logFCScale,
  directionScale,
  directionColors,
  discreteScale,
  type ColorStops,
} from '@/utils/chartScales';

/**
 * Les echelles ne se verifient pas a l'oeil : Plotly les rend en canvas, et une
 * rampe fausse a l'air d'une rampe. Ce fichier fixe les proprietes MESURABLES
 * qui ont motive le module — chacune correspond a un defaut reel trouve dans le
 * code qu'il remplace.
 */

// ── Outils de mesure, volontairement locaux : un test qui importe sa propre
// definition de la clarte ne prouve rien sur celle du module. ───────────────
function srgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
function linear(u: number) {
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const [r, g, b] = srgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Clarte perceptuelle OKLab : la luminance relative ecrase le bas de la rampe. */
function okLightness(hex: string) {
  const [r, g, b] = srgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

const DARK_SURFACE = '#131720';
const positions = (s: ColorStops) => s.map(([p]) => p);
const colors = (s: ColorStops) => s.map(([, c]) => c);

describe('forme commune', () => {
  const ALL: [string, ColorStops][] = [
    ['sequentielle claire', sequentialScale('light')],
    ['sequentielle sombre', sequentialScale('dark')],
    ['divergente claire', divergingScale('standard', 'light')],
    ['divergente sombre', divergingScale('standard', 'dark')],
    ['divergente daltonisme sombre', divergingScale('colorblind', 'dark')],
    ['log2FC claire', logFCScale('standard', 'light')],
    ['log2FC sombre', logFCScale('standard', 'dark')],
    ['direction claire', directionScale('standard', 'light')],
  ];

  it.each(ALL)('%s couvre [0,1] en positions croissantes', (_name, stops) => {
    const p = positions(stops);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(1);
    expect([...p].sort((a, b) => a - b)).toEqual(p);
  });

  it.each(ALL)('%s ne rend que des hexadecimaux a six chiffres', (_name, stops) => {
    for (const c of colors(stops)) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('rampe sequentielle', () => {
  /**
   * Le defaut d'origine : la rampe « daltonisme » allait #F0E442 (clair) puis
   * #E69F00 (plus sombre). Une rampe sequentielle porte son ordre dans la
   * clarte ; non monotone, deux valeurs distinctes prennent la meme apparence.
   */
  it.each(['light', 'dark'] as const)('est strictement croissante en clarte (%s)', (theme) => {
    const l = colors(sequentialScale(theme)).map(okLightness);
    for (let i = 1; i < l.length; i += 1) expect(l[i]).toBeGreaterThan(l[i - 1]);
  });

  it('decolle du panneau en theme sombre', () => {
    // `#000080` etait a 1,12:1 du panneau : les cellules basses ne se lisaient
    // plus comme des cellules.
    const lowest = colors(sequentialScale('dark'))[0];
    expect(contrast(lowest, DARK_SURFACE)).toBeGreaterThan(1.3);
  });
});

describe('point median', () => {
  /**
   * Les echelles NOMMEES de Plotly ('RdBu', 'PiYG') ont un blanc cuit au
   * milieu. En sombre, chaque carte de chaleur avait donc un trou blanc la ou
   * la donnee ne dit rien — l'element le plus lumineux de l'ecran designait
   * l'absence de signal.
   */
  const DARK_DIVERGING: [string, ColorStops][] = [
    ['divergente', divergingScale('standard', 'dark')],
    ['divergente daltonisme', divergingScale('colorblind', 'dark')],
    ['log2FC', logFCScale('standard', 'dark')],
  ];

  it.each(DARK_DIVERGING)('%s : le median recule au lieu de crier', (_n, stops) => {
    const mid = stops.find(([p]) => p === 0.5);
    expect(mid).toBeDefined();
    expect(contrast(mid![1], DARK_SURFACE)).toBeLessThan(1.5);
  });

  it('en theme clair le median reste quasi-blanc', () => {
    const mid = divergingScale('standard', 'light').find(([p]) => p === 0.5);
    expect(contrast(mid![1], '#ffffff')).toBeLessThan(1.2);
  });
});

describe('direction', () => {
  it('suit la convention du produit : rouge en bas, vert en haut', () => {
    // Le violet/vert d'origine contredisait tous les autres ecrans.
    const { down, up } = directionColors('standard', 'light');
    const red = (c: string) => srgb(c)[0] > srgb(c)[1];
    expect(red(down)).toBe(true);
    expect(red(up)).toBe(false);
  });

  it('saute franchement plutot que de degrader', () => {
    const stops = directionScale('standard', 'light');
    const [, low] = stops[1];
    const [, high] = stops[2];
    expect(low).not.toBe(high);
    expect(stops[2][0] - stops[1][0]).toBeLessThanOrEqual(0.05);
  });

  it('tient le plancher non-textuel de 3:1 dans les deux themes', () => {
    // Le violet #7B2D8B tombait a 2,21:1 sur panneau sombre.
    for (const [theme, bg] of [['light', '#ffffff'], ['dark', DARK_SURFACE]] as const) {
      for (const mode of ['standard', 'colorblind'] as const) {
        const { down, up } = directionColors(mode, theme);
        expect(contrast(down, bg)).toBeGreaterThanOrEqual(3);
        expect(contrast(up, bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('discreteScale', () => {
  it('rend des paliers francs, deux stops par couleur', () => {
    expect(discreteScale(['#111111', '#222222'])).toEqual([
      [0, '#111111'], [0.5, '#111111'],
      [0.5, '#222222'], [1, '#222222'],
    ]);
  });

  it('survit a une liste vide plutot que de rendre une echelle invalide', () => {
    // Une piste de conditions est vide quand aucune metadonnee n'est chargee.
    const stops = discreteScale([]);
    expect(positions(stops)).toEqual([0, 1]);
  });
});
