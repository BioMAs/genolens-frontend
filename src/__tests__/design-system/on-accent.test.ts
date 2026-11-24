import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Texte sur aplat d'accent : jamais du blanc en dur.
 *
 * En mode clair la prune et le lagon sont SOMBRES, en mode sombre ils sont CLAIRS
 * (76-80 % de L). Un `#fff` pose sur eux donne 2,19:1 (prune) et 1,81:1 (lagon) en
 * sombre : la page courante de la pagination, l'etape courante de l'assistant,
 * l'onglet actif disparaissaient. Le texte sur un aplat d'accent est `--gl-on-plum`
 * (utilitaire `text-on-accent`), qui s'inverse avec lui ; un fond de panneau est
 * `bg-surface`, jamais `bg-white`.
 *
 * La garde est volontairement plus large que « un blanc sur un aplat nomme » : un
 * aplat peut venir d'une variable (`background: active ? color : …`), et aucun regex
 * ne sait alors lire le nom de la teinte. Tout blanc ecrit comme COULEUR d'interface
 * (texte, fond, bordure, anneau) est donc refuse, sauf dans la liste ci-dessous.
 */

const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter(
    (f) =>
      /\.tsx?$/.test(f) &&
      !f.includes('__tests__') &&
      !/\.test\.tsx?$/.test(f) &&
      // La route de labo (non versionnee) n'est pas du produit.
      !f.includes('lentille-lab'),
  );

const STYLESHEETS: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter((f) => f.endsWith('.css'));

/**
 * Les fichiers ou un blanc litteral est JUSTE : le fond ne change pas avec le theme.
 * Chaque entree dit pourquoi. Elle reste vide tant qu'aucun cas reel n'existe : le
 * premier qui s'y ajoute doit se justifier ici, pas dans un commentaire perdu.
 */
const ALLOWED: Record<string, string> = {
  'src/components/cosmomics/novaPalette.ts':
    'La nova est une figure a fond clair dans les DEUX themes (grammaire de la charte : halos blancs, secteurs pales) : son blanc ne bascule pas.',
};

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Un utilitaire Tailwind qui peint en blanc : text-white, bg-white, border-white/30, ring-offset-white… */
const WHITE_UTILITY =
  /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|divide|from|to|via|outline|fill|stroke|shadow|decoration|caret|accent|placeholder)-white(?![\w-])/g;

/**
 * Une couleur d'interface posee en JS : `color: '#fff'`, `background: 'white'`, `borderColor: "#ffffff"`,
 * y compris dans une branche de ternaire (`color: active ? '#fff' : color`).
 */
const WHITE_STYLE =
  /\b(?:color|background|backgroundColor|borderColor|outlineColor)\s*:[^,;}\n]*?['"`](?:#fff(?:fff)?|white)['"`]/gi;

/** Tous les blancs litteraux d'un source (et non le premier : on veut la liste complete des fautifs). */
const whiteLiterals = (src: string): string[] => [
  ...[...src.matchAll(WHITE_UTILITY)].map((m) => m[0]),
  ...[...src.matchAll(WHITE_STYLE)].map((m) => m[0]),
];

describe('texte sur aplat d’accent (TSX)', () => {
  it('aucun blanc en dur comme couleur d’interface', () => {
    const offenders = SOURCES.filter((file) => !(file in ALLOWED)).flatMap((file) => {
      return whiteLiterals(stripComments(readFileSync(file, 'utf8'))).map((hit) => `${file}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });

  /**
   * Le danger plein s'ecrit `bg-danger-fill` (4,69:1 sous le texte en clair). `bg-danger` est la teinte
   * de bordure et d'anneau : en aplat sous `text-on-accent` il ne tient que 3,65:1 en clair. Et
   * `bg-danger-hover` n'existe plus : une classe sans jeton ne peint rien, sans que rien ne le dise.
   */
  it('le danger plein passe par bg-danger-fill, et bg-danger-hover n’existe plus', () => {
    const strings = (src: string) => src.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
    const offenders = SOURCES.flatMap((file) =>
      strings(stripComments(readFileSync(file, 'utf8')))
        .filter(
          (lit) =>
            (/(?<![\w-])bg-danger(?![\w-])/.test(lit) && /(?<![\w-])text-on-accent(?![\w-])/.test(lit)) ||
            /(?<![\w-])(?:hover:)?bg-danger-hover(?![\w-])/.test(lit),
        )
        .map((lit) => `${file}: ${lit.slice(0, 90)}`),
    );
    expect(offenders).toEqual([]);
  });

  it('toute entree de la liste blanche a une raison', () => {
    for (const [file, why] of Object.entries(ALLOWED)) {
      expect(why.trim().length).toBeGreaterThan(10);
      expect(SOURCES).toContain(file);
    }
  });

  it('temoin positif : le scanner reconnait les formes fautives et laisse passer les bonnes', () => {
    for (const bad of [
      "{ background: 'var(--sl-teal)', color: '#fff' }",
      "{ background: 'var(--sl-purple)', color: '#ffffff', borderColor: 'var(--sl-purple)' }",
      'style={{ color: "white" }}',
      'className="bg-brand-primary text-white hover:bg-brand-primary/90"',
      'className="border border-strong bg-white text-secondary"',
      'className="border-2 border-white/30 border-t-white"',
      'className="focus:ring-offset-white"',
      "{ background: active ? color : 'x', color: active ? '#fff' : color }",
    ]) {
      expect(whiteLiterals(bad)).not.toEqual([]);
    }
    for (const good of [
      "{ background: 'var(--sl-teal)', color: 'var(--gl-on-plum)' }",
      'className="bg-plum text-on-accent hover:bg-plum-hover"',
      'className="border border-strong bg-surface text-secondary"',
      'className="whitespace-nowrap text-whitespace"',
      '<circle fill="#fff" />',
      '<stop stopColor="#fff" stopOpacity="0" />',
    ]) {
      expect(whiteLiterals(good)).toEqual([]);
    }
  });

  it('temoin positif : le scanner lit bien les sources', () => {
    // Un `SOURCES` vide ou un mauvais chemin rendrait la garde verte sans rien regarder.
    expect(SOURCES.length).toBeGreaterThan(300);
  });
});

describe('texte sur aplat d’accent (CSS)', () => {
  /** Un fond pris dans la famille accent / marque : prune, lagon, ou leurs anciens noms. */
  const ACCENT_FILL =
    /background(?:-color)?\s*:[^;]*var\(--(?:sl-purple|sl-teal|gl-plum|gl-lagoon|accent|color-accent|color-brand|brand)\b/;
  const WHITE_TEXT = /(?:^|[;\s])color\s*:\s*(?:#fff(?:fff)?|white)\s*(?:;|$)/i;

  const offendersIn = (css: string): string[] =>
    [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => ACCENT_FILL.test(body) && WHITE_TEXT.test(body))
      .map(([, selector]) => selector.trim().replace(/\s+/g, ' '));

  it('aucune regle ne pose du blanc sur un aplat d’accent', () => {
    const offenders = STYLESHEETS.flatMap((sheet) =>
      offendersIn(readFileSync(sheet, 'utf8')).map((selector) => `${sheet}: ${selector}`),
    );
    expect(offenders).toEqual([]);
  });

  it('temoin positif : la regle fautive est reconnue, la bonne passe', () => {
    expect(
      offendersIn('.tour .next-btn { background: var(--sl-purple, #6d28d9); color: #ffffff; }'),
    ).toEqual(['.tour .next-btn']);
    expect(
      offendersIn('.tour .next-btn { background: var(--sl-purple); color: var(--gl-on-plum, #fff); }'),
    ).toEqual([]);
    // L'espace d'authentification a sa propre palette, sombre dans les deux modes.
    expect(offendersIn('.auth-btn { background: var(--auth-brand); color: #fff; }')).toEqual([]);
  });

  it('temoin positif : les feuilles de style sont trouvees', () => {
    expect(STYLESHEETS).toEqual(expect.arrayContaining(['src/app/globals.css', 'src/styles/driver-theme.css']));
  });
});
