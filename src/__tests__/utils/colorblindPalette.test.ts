import { readFileSync } from 'node:fs';
import { getPalette } from '@/utils/chartPalettes';
import { parseColor } from '@/utils/colorContrast';

/**
 * La palette du mode daltonisme, mesuree a chaque execution.
 *
 * Elle n'est pas verifiable a l'oeil — c'est tout le probleme : trois des huit
 * couleurs de Wong 2011 echouaient au plancher de contraste sur blanc depuis
 * le debut du projet, et personne ne l'avait vu. Le commentaire qui justifiait
 * de les garder citait par ailleurs un chiffre de separation (0,1415) qui
 * n'etait reproductible sous aucune definition.
 *
 * Ce fichier recalcule donc TOUT depuis les valeurs livrees : conversions
 * OKLab, simulations de dichromatie, contrastes. Un chiffre qu'on ne peut pas
 * refaire ne prouve rien.
 */

// ── sRGB → OKLab ────────────────────────────────────────────────────────────
function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
const linear = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);

function oklab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = channels(hex).map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Simulations de dichromatie — memes matrices LMS que l'optimisation. */
const CVD: Record<string, number[][] | null> = {
  normal: null,
  deuter: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  protan: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  tritan: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
};

function simulate(hex: string, kind: string): string {
  const M = CVD[kind];
  if (!M) return hex;
  const [r, g, b] = channels(hex);
  const out = [0, 1, 2].map((i) =>
    Math.max(0, Math.min(1, M[i][0] * r + M[i][1] * g + M[i][2] * b)),
  );
  return `#${out.map((u) => Math.round(u * 255).toString(16).padStart(2, '0')).join('')}`;
}

const distance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** La separation d'une paire est son PIRE cas sur les quatre visions. */
function pairSeparation(a: string, b: string) {
  return Math.min(
    ...Object.keys(CVD).map((k) => distance(oklab(simulate(a, k)), oklab(simulate(b, k)))),
  );
}

function paletteSeparation(colors: readonly string[]) {
  let worst = Infinity;
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      worst = Math.min(worst, pairSeparation(colors[i], colors[j]));
    }
  }
  return worst;
}

const SURFACE = { light: '#ffffff', dark: '#131720' } as const;
/** Ce que la palette precedente atteignait, mesure par ce meme code. */
const WONG_SEPARATION = 0.0478;
const THEMES = ['light', 'dark'] as const;

describe('palette daltonisme', () => {
  it.each(THEMES)('tient le plancher non-textuel de 3:1 sur sa surface (%s)', (theme) => {
    // Wong en echouait TROIS sur huit en clair — #F0E442 a 1,32:1.
    for (const color of getPalette('colorblind', theme).categorical) {
      expect(contrast(color, SURFACE[theme])).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(THEMES)('ne monte pas non plus jusqu’au quasi-noir (%s)', (theme) => {
    // Le plafond compte autant : trois couleurs a 12:1 sur blanc sont trois
    // noirs pour une vision normale, meme si OKLab les separe.
    for (const color of getPalette('colorblind', theme).categorical) {
      expect(contrast(color, SURFACE[theme])).toBeLessThanOrEqual(10);
    }
  });

  it.each(THEMES)('separe mieux que Wong 2011 sous dichromatie (%s)', (theme) => {
    const separation = paletteSeparation(getPalette('colorblind', theme).categorical);
    expect(separation).toBeGreaterThan(WONG_SEPARATION * 2);
  });

  it.each(THEMES)('ne s’effondre sous aucune des quatre visions (%s)', (theme) => {
    /**
     * C'est ici que Wong perdait : excellent en vision normale (0,1558), il
     * tombait a 0,0478 en tritanopie. Une palette « sure » doit etre PLATE
     * d'une vision a l'autre, sinon elle n'est sure que pour qui voit tout.
     */
    const colors = getPalette('colorblind', theme).categorical;
    for (const kind of Object.keys(CVD)) {
      let worst = Infinity;
      for (let i = 0; i < colors.length; i += 1) {
        for (let j = i + 1; j < colors.length; j += 1) {
          worst = Math.min(
            worst,
            distance(oklab(simulate(colors[i], kind)), oklab(simulate(colors[j], kind))),
          );
        }
      }
      expect(worst).toBeGreaterThan(0.1);
    }
  });

  it.each(THEMES)('reste distincte du gris « non significatif » (%s)', (theme) => {
    // `ns` COEXISTE avec les categories : la PCA l'emploie pour « Unknown » a
    // cote des couleurs de groupe. C'est la contrainte qui a coute 21 % de
    // separation intra-palette, et elle n'etait pas facultative.
    const { categorical, ns } = getPalette('colorblind', theme);
    for (const color of categorical) {
      expect(pairSeparation(color, ns)).toBeGreaterThan(0.08);
    }
  });

  it.each(THEMES)('place les couleurs les mieux separees en tete (%s)', (theme) => {
    // La plupart des graphiques n'emploient que trois a cinq series : le debut
    // de la liste doit etre meilleur que l'ensemble, sinon l'ordre ment.
    const colors = getPalette('colorblind', theme).categorical;
    expect(paletteSeparation(colors.slice(0, 4))).toBeGreaterThan(paletteSeparation(colors));
  });
});

/**
 * Les couleurs de direction du mode STANDARD suivent les jetons de la spec § 2.1
 * (terre cuite / bleu acier), le mode daltonisme ne bouge pas.
 *
 * `chartPalettes.ts` est un module pur — il ne peut pas lire `--gl-up` — donc ses valeurs sont des
 * hex, c'est-a-dire un arrondi de l'oklch d'origine : la comparaison tolere 1/255 par canal.
 */
describe('palette standard — up / down / ns = jetons --gl-*', () => {
  const SPEC = {
    light: { up: 'oklch(57% 0.16 38)', down: 'oklch(47% 0.12 250)', ns: 'oklch(86% 0.01 260)' },
    dark: { up: 'oklch(75% 0.14 45)', down: 'oklch(64% 0.12 245)', ns: 'oklch(42% 0.015 285)' },
  } as const;
  const KEYS = ['up', 'down', 'ns'] as const;

  function expectSameColor(hex: string, token: string) {
    const got = channels(hex);
    const want = parseColor(token);
    [want.r, want.g, want.b].forEach((w, i) => {
      expect(Math.abs(got[i] - w)).toBeLessThanOrEqual(1 / 255 + 1e-9);
    });
  }

  /** La valeur d'un jeton dans le bloc `:root` ou `.dark` de globals.css. */
  function cssToken(selector: ':root' | '.dark', name: string): string {
    const css = readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // Le premier bloc suit des `@import …;` : seul ce qui suit le dernier `;` est le selecteur.
      if (sel.split(';').pop()?.trim() !== selector) continue;
      const hit = new RegExp(`${name}:\\s*([^;]+);`).exec(body);
      if (hit) return hit[1].trim();
    }
    throw new Error(`${name} introuvable dans ${selector}`);
  }

  it.each(THEMES)('reprend les valeurs de la spec (%s)', (theme) => {
    const palette = getPalette('standard', theme);
    for (const key of KEYS) expectSameColor(palette[key], SPEC[theme][key]);
  });

  it.each(THEMES)('ne derive pas de globals.css (%s)', (theme) => {
    const palette = getPalette('standard', theme);
    const selector = theme === 'light' ? ':root' : '.dark';
    for (const key of KEYS) expectSameColor(palette[key], cssToken(selector, `--gl-${key}`));
  });

  it.each(THEMES)('up est chaud et down est froid, jamais rouge contre vert (%s)', (theme) => {
    const { up, down } = getPalette('standard', theme);
    const [ur, , ub] = channels(up);
    const [dr, , db] = channels(down);
    expect(ur).toBeGreaterThan(ub);
    expect(db).toBeGreaterThan(dr);
  });

  it('laisse la palette daltonienne telle quelle (Okabe-Ito, octet pour octet)', () => {
    const pick = (theme: 'light' | 'dark') => {
      const { up, down, ns } = getPalette('colorblind', theme);
      return { up, down, ns };
    };
    expect(pick('light')).toEqual({ up: '#D55E00', down: '#0072B2', ns: '#c7ccd4' });
    expect(pick('dark')).toEqual({ up: '#D55E00', down: '#56B4E9', ns: '#4a5568' });
  });
});
