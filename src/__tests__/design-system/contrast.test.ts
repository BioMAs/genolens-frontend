import { readFileSync } from 'node:fs';

import { contrastRatio, parseColor } from '@/utils/colorContrast';

/**
 * Garde de contraste des jetons « Lentille ».
 *
 * Les valeurs vivent dans globals.css (clair dans `:root`, sombre dans `.dark`) ;
 * ce test les LIT, il ne les recopie pas. Une couleur retouchee a l'oeil et qui
 * passe sous un plancher WCAG fait donc echouer le build, mode par mode.
 *
 * Planchers : 7:1 pour l'encre principale, 4,5:1 pour tout texte, 3:1 pour un
 * element graphique ou un anneau de focus.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8');

/** Le CSS sans ses commentaires : ils citent des accolades et des selecteurs. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Les declarations `--nom: valeur` de TOUS les blocs de premier niveau dont le
 * selecteur est exactement `selector`. Les blocs imbriques (@media, @theme…) et
 * les selecteurs composes (`:root, .dark`, `.dark .x`) sont ignores a dessein.
 */
function rawTokens(css: string, selector: string): Record<string, string> {
  const source = stripComments(css);
  const out: Record<string, string> = {};
  let depth = 0;
  let head = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0 && source.slice(head, i).trim() === selector) {
        let end = i + 1;
        let inner = 1;
        while (end < source.length && inner > 0) {
          if (source[end] === '{') inner++;
          else if (source[end] === '}') inner--;
          end++;
        }
        const body = source.slice(i + 1, end - 1);
        for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
          out[name] = value.trim();
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) head = i + 1;
    } else if (ch === ';' && depth === 0) {
      // Un at-rule sans bloc (`@import …;`) termine ici : il ne fait pas partie du selecteur suivant.
      head = i + 1;
    }
  }
  return out;
}

/** Resout `var(--x)` jusqu'a un litteral (cinq niveaux au plus). */
function resolveTokens(raw: Record<string, string>): Record<string, string> {
  const resolve = (value: string, hops = 0): string => {
    const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
    if (!ref) return value;
    if (hops >= 5 || !(ref[1] in raw)) throw new Error(`Unresolvable ${value}`);
    return resolve(raw[ref[1]], hops + 1);
  };
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, resolve(v)]));
}

/** Les jetons d'un bloc, `var()` resolus a l'interieur de ce bloc. */
function readTokens(css: string, selector: string): Record<string, string> {
  return resolveTokens(rawTokens(css, selector));
}

/** Les jetons EFFECTIFS d'un mode : `.dark` se pose sur `:root`, puis on resout. */
function modeTokens(mode: 'light' | 'dark'): Record<string, string> {
  const root = rawTokens(CSS, ':root');
  return resolveTokens(mode === 'light' ? root : { ...root, ...rawTokens(CSS, '.dark') });
}

const MODES = ['light', 'dark'] as const;

const GL_TOKENS = [
  '--gl-paper', '--gl-paper-2', '--gl-surface',
  '--gl-ink', '--gl-ink-2', '--gl-muted', '--gl-rule', '--gl-rule-2',
  '--gl-lagoon', '--gl-lagoon-ink', '--gl-lagoon-soft', '--gl-slate', '--gl-slate-ink',
  '--gl-plum', '--gl-plum-hover', '--gl-plum-soft', '--gl-on-plum',
  '--gl-up', '--gl-down', '--gl-ns', '--gl-focus',
];

/** [premier plan, fond, ratio minimal] */
const PAIRS: Array<[string, string, number]> = [
  ['--gl-ink', '--gl-paper', 7],
  ['--gl-ink-2', '--gl-paper', 4.5],
  ['--gl-muted', '--gl-paper', 4.5],
  ['--gl-muted', '--gl-surface', 4.5],
  ['--gl-on-plum', '--gl-plum', 4.5],
  ['--gl-plum', '--gl-surface', 4.5],
  ['--gl-lagoon-ink', '--gl-surface', 4.5],
  // L'ardoise en TEXTE : --gl-slate sert aux aplats et aux jauges (3:1 suffit), --gl-slate-ink au texte.
  ['--gl-slate-ink', '--gl-paper', 4.5],
  ['--gl-slate-ink', '--gl-surface', 4.5],
  ['--gl-up', '--gl-surface', 3],
  ['--gl-down', '--gl-surface', 3],
  ['--gl-focus', '--gl-surface', 3],
];

/**
 * Les aplats qui portent un texte `text-on-accent` (--gl-on-plum) : [jeton de l'aplat, ce qu'il peint].
 *
 * Le piege est la COMPOSITION : --gl-on-plum s'inverse avec la prune (sombre en mode sombre), mais un
 * aplat de statut ou un cran de survol qui ne s'inverse pas avec lui donne du sombre sur du sombre. Les
 * paires du dessus ne voient que `jeton / fond` ; celles-ci voient le texte tel qu'il est peint, repos ET
 * survol, dans les deux modes. 4,5:1 : c'est du texte.
 */
const ON_ACCENT_FILLS: Array<[string, string]> = [
  ['--gl-plum', 'bg-accent, bg-plum'],
  ['--gl-plum-hover', 'hover:bg-accent-hover, hover:bg-plum-hover'],
  ['--sl-teal', 'bg-brand (aplat de marque, bouton brand)'],
  ['--sl-teal-dark', 'bg-success'],
  ['--success-fill-hover', 'hover:bg-success-hover'],
  ['--warning-ink', 'bg-warning'],
  ['--warning-fill-hover', 'hover:bg-warning-hover'],
  ['--danger-fill', 'bg-danger-fill (bouton destructif, bandeau de licence)'],
  ['--danger-fill-hover', 'hover:bg-danger-fill-hover'],
];

/** [aplat au repos, son cran de survol] : le survol RENFORCE l'aplat, dans les deux modes. */
const FILL_HOVERS: Array<[string, string]> = [
  ['--gl-plum', '--gl-plum-hover'],
  ['--sl-teal', '--success-fill-hover'],
  ['--sl-teal-dark', '--success-fill-hover'],
  ['--warning-ink', '--warning-fill-hover'],
  ['--danger-fill', '--danger-fill-hover'],
];

/** L d'un `oklch(L% C H)`, en points (0-100). */
const lightness = (value: string): number => parseFloat(/^oklch\(\s*([\d.]+)%/i.exec(value)![1]);

describe.each(MODES)('jetons Lentille — mode %s', (mode) => {
  const tokens = modeTokens(mode);

  it('declare les vingt et un jetons --gl-*, tous lisibles par parseColor', () => {
    for (const name of GL_TOKENS) {
      expect(tokens[name]).toBeDefined();
      expect(() => parseColor(tokens[name])).not.toThrow();
    }
  });

  it.each(PAIRS)('%s sur %s tient au moins %f:1', (fg, bg, floor) => {
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    // Message explicite : un echec doit dire QUELLE paire et QUEL ratio mesure.
    expect({ fg, bg, ratio: Number(ratio.toFixed(2)), ok: ratio >= floor }).toMatchObject({
      ok: true,
    });
  });

  it('up et down different aussi en clarte (au moins 8 points de L)', () => {
    expect(Math.abs(lightness(tokens['--gl-up']) - lightness(tokens['--gl-down']))).toBeGreaterThanOrEqual(8);
  });

  it.each(ON_ACCENT_FILLS)('texte --gl-on-plum sur l’aplat %s (%s) tient au moins 4,5:1', (fill) => {
    const ratio = contrastRatio(tokens['--gl-on-plum'], tokens[fill]);
    expect({ fill, ratio: Number(ratio.toFixed(2)), ok: ratio >= 4.5 }).toMatchObject({ ok: true });
  });

  it.each(FILL_HOVERS)('le survol de %s (%s) ne perd pas de contraste avec le texte', (rest, hover) => {
    // En clair l'aplat s'assombrit, en sombre il s'eclaircit : dans les deux cas le texte (qui
    // s'inverse) y gagne. Un survol qui perd du contraste est un survol qui ne se lit plus.
    const onRest = contrastRatio(tokens['--gl-on-plum'], tokens[rest]);
    const onHover = contrastRatio(tokens['--gl-on-plum'], tokens[hover]);
    expect({ rest, hover, onRest: Number(onRest.toFixed(2)), onHover: Number(onHover.toFixed(2)), ok: onHover >= onRest }).toMatchObject({ ok: true });
  });
});

describe('anciens noms — alias des jetons Lentille', () => {
  /** Les noms que le code TSX reference encore : ils ne sont pas renommes, seulement re-branches. */
  const ALIASES = [
    '--sl-purple', '--sl-purple-dark', '--sl-purple-light', '--sl-purple-muted',
    '--sl-teal', '--sl-teal-dark', '--sl-teal-light', '--sl-teal-muted',
    '--sl-violet', '--sl-violet-dark', '--sl-violet-light', '--sl-violet-muted',
    '--accent-ink',
    '--chart-up', '--chart-down', '--chart-ns', '--dc-up', '--dc-down',
    '--dc-up-dark', '--dc-down-dark',
    '--n-0', '--n-25', '--n-50', '--n-100', '--n-200', '--n-300',
    '--n-400', '--n-500', '--n-600', '--n-700', '--n-800', '--n-900',
    '--background', '--foreground', '--app-bg',
    '--surface', '--surface-secondary', '--surface-raised',
    '--text-primary', '--text-secondary', '--text-muted',
    '--border', '--border-subtle', '--border-strong',
  ];

  it.each(MODES)('chaque alias resout sur une couleur oklch, en mode %s', (mode) => {
    const tokens = modeTokens(mode);
    const stale = ALIASES.filter((name) => !/^oklch\(/i.test(tokens[name] ?? ''));
    expect(stale).toEqual([]);
  });

  it('--sl-teal-dark a une valeur sombre propre (il n’en avait aucune)', () => {
    expect(modeTokens('dark')['--sl-teal-dark']).not.toBe(modeTokens('light')['--sl-teal-dark']);
  });

  it('texte --sl-teal-dark lisible sur sa surface dans les deux modes', () => {
    for (const mode of MODES) {
      const tokens = modeTokens(mode);
      expect(contrastRatio(tokens['--sl-teal-dark'], tokens['--surface'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("les alias d'ardoise employes comme TEXTE suivent --gl-slate-ink, pas l'aplat --gl-slate", () => {
    for (const mode of MODES) {
      const tokens = modeTokens(mode);
      expect(tokens['--sl-violet']).toBe(tokens['--gl-slate-ink']);
      // Le texte IA sur sa surface douce (badge, pastille) tient le plancher texte.
      expect(contrastRatio(tokens['--sl-violet'], tokens['--sl-violet-light'])).toBeGreaterThanOrEqual(4.5);
    }
    // `text-ai` / `border-ai` : l'utilitaire @theme n'est employe que comme encre.
    expect(stripComments(CSS)).toMatch(/--color-ai:\s*var\(--gl-slate-ink\)\s*;/);
  });

  it("l'anneau de focus utilise --gl-focus (et non plus l'accent)", () => {
    const rule = /(?:^|\n):focus-visible\s*\{([^}]*)\}/.exec(stripComments(CSS));
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('var(--gl-focus)');
    expect(rule![1]).not.toContain('--sl-purple');
    // Etat, pas mouvement : il apparait sans transition.
    expect(rule![1]).not.toMatch(/transition/);
  });

  it('declare les deux jetons jusque-la jamais declares', () => {
    for (const mode of MODES) {
      const tokens = modeTokens(mode);
      expect(tokens['--sl-amber-light']).toBe(tokens['--warning-soft']);
      expect(tokens['--sl-blue']).toBe(tokens['--info-ink']);
    }
  });

  it('les utilitaires de statut pointent sur les jetons d’aplat, pas sur une encre de texte', () => {
    const css = stripComments(CSS);
    const maps = (utility: string, token: string) =>
      expect(css).toMatch(new RegExp(`--color-${utility}:\\s*var\\(--${token}\\)\\s*;`));
    maps('success-hover', 'success-fill-hover');
    maps('warning-hover', 'warning-fill-hover');
    maps('danger-fill', 'danger-fill');
    maps('danger-fill-hover', 'danger-fill-hover');
    // --sl-red-dark est aussi un TEXTE : il ne doit plus servir de survol d'aplat.
    expect(css).not.toMatch(/--color-danger-hover\s*:/);
  });

  it('le rayon de carte vaut 14px (concentrique : 14 - 4 = 10, 10 - 4 = 6)', () => {
    expect(readTokens(CSS, ':root')['--radius-card-px']).toBe('14px');
  });

  it("le point d'etat `warning` n'a plus de #f59e0b en dur", () => {
    const rule = /\.status-dot\.warning\s*\{([^}]*)\}/.exec(stripComments(CSS));
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('var(--warning-ink)');
    expect(rule![1]).not.toMatch(/#f59e0b/i);
  });
});
