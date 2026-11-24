import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La construction des chaines de classe.
 *
 * Un defaut precis est apparu CINQ fois dans ce produit, toujours identique :
 *
 *     className={`... transition-colors${actif ? 'bg-x' : ''}`}
 *
 * Sans espace avant l'interpolation, les deux classes qui se touchent
 * fusionnent en un token invalide, et les DEUX sont perdues. Le compilateur ne
 * dit rien, les tests passent, et le resultat est un etat actif qui ne se voit
 * pas — ou un survol qui ne fait rien.
 *
 * Il a ete trouve dans la bascule daltonisme, la recherche globale, les
 * pastilles d'espace de noms GO, la table GSEA et la table d'enrichissement.
 * Cinq fois signifie que ce n'est pas une inattention mais une forme, et
 * qu'elle reviendra. `cn()` la rend impossible.
 */
const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__'));

const read = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Une liste de classes ne se construit plus par gabarit : `cn()` joint ses
 * arguments lui-meme, donc la faute devient impossible a ecrire.
 *
 * Une premiere version de cette garde ne signalait que la forme PROUVABLE — une
 * classe collee a `${` avec une branche litterale visible — parce qu'un regex
 * ne sait pas lire toutes les branches d'une expression quelconque, et que
 * `` `nav-item${a ? ' active' : ''}` `` est correct. Cette prudence etait juste
 * tant que 120 gabarits restaient a convertir. Ils le sont : la regle forte
 * peut remplacer l'approximation.
 *
 * La conversion a d'ailleurs trouve NEUF collages de plus que les six repares
 * a la main — dont la surbrillance de l'element selectionne d'un `Select`, qui
 * n'existait tout simplement pas.
 */
const TEMPLATE_CLASS = /className=\{`[^`]*\$\{/;

/** `.auth-scope` garde ses propres conventions, palette comprise. */
const AUTH_SCOPE = /\/auth\/|^src\/app\/page\.tsx$/;

describe('interpolation dans une liste de classes', () => {
  it('aucune liste de classes construite par gabarit', () => {
    const offenders = SOURCES.filter((f) => !AUTH_SCOPE.test(f) && TEMPLATE_CLASS.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('bandes laterales', () => {
  /**
   * Une bordure gauche ou droite de 2px et plus, posee comme accent sur une
   * ligne, une carte ou un encart : le tic decoratif le plus repandu des
   * interfaces de tableau de bord. La derniere (selection de l'arbre GO) a ete
   * remplacee par une teinte et un filet complet ; cette garde empeche la
   * suivante. Un filet de 1px reste permis : c'est une separation, pas un accent.
   */
  const STRIPE = /\bborder-[lrse]-(?:[2-9]|\[[2-9]px\])\b|border(?:Left|Right|InlineStart|InlineEnd)\s*:\s*['"`]?[2-9]px/;

  it('aucune bordure laterale epaisse en guise d’accent', () => {
    const offenders = SOURCES.filter((file) => !file.includes('/auth/')).filter((file) =>
      STRIPE.test(read(file))
    );
    expect(offenders).toEqual([]);
  });
});

describe('police d’affichage (Newsreader)', () => {
  /**
   * Spec § 2.2 : Newsreader est reservee aux titres de page, aux titres de section et aux grands
   * chiffres — jamais a un libelle, un bouton, une cellule de tableau ou une donnee. `font-display`
   * rend desormais Newsreader (et non plus la police du corps) : chaque emploi doit donc se
   * justifier. Soit l'element est un `<h1>` / `<h2>`, soit il porte un cran de l'echelle
   * typographique >= `title`.
   *
   * La liste blanche est LUE dans `@theme inline` de globals.css, pas recopiee, pour ne pas
   * deriver quand l'echelle bouge. L'echelle actuelle :
   *   micro 11px · caption 12 · body-sm 13 · body 16 · title 17 · heading 22 · display 30 · hero 48
   * Sont admis `text-title` (17px) et au-dela. En dessous, l'element est un libelle, une cellule ou
   * une donnee, et reste en Instrument Sans.
   */
  const SCALE = [
    ...readFileSync('src/app/globals.css', 'utf8').matchAll(
      /^\s*--text-([a-z]+(?:-[a-z]+)?):\s*([\d.]+)rem;/gm
    ),
  ].map(([, name, rem]) => ({ name, rem: Number(rem) }));
  const TITLE_REM = SCALE.find((s) => s.name === 'title')?.rem ?? Infinity;
  const DISPLAY_SIZES = new Set(SCALE.filter((s) => s.rem >= TITLE_REM).map((s) => `text-${s.name}`));

  it('la liste blanche est lue dans l’echelle : title, heading, display, hero', () => {
    expect([...DISPLAY_SIZES].sort()).toEqual(
      ['text-display', 'text-heading', 'text-hero', 'text-title']
    );
  });

  /** Chaque `font-display` d'un source : balise englobante + liste de classes qui le porte. */
  function displayUsesIn(src: string) {
    const uses: Array<{ tag: string; classes: string }> = [];
    for (let i = src.indexOf('font-display'); i !== -1; i = src.indexOf('font-display', i + 1)) {
      const open = Math.max(src.lastIndexOf('"', i), src.lastIndexOf("'", i), src.lastIndexOf('`', i));
      const close = src.indexOf(src[open], i);
      const tag = /^<([A-Za-z][\w.]*)/.exec(src.slice(src.lastIndexOf('<', i)))?.[1] ?? '?';
      uses.push({ tag, classes: src.slice(open + 1, close) });
    }
    return uses;
  }
  const displayUses = (file: string) => displayUsesIn(read(file));

  /**
   * Un emploi est deplace quand il tombe sur un libelle, un bouton, une cellule ou un lien — QUELLE
   * QUE SOIT SA TAILLE : un `text-title` sur un `<td>` reste une donnee, pas un titre. Sinon il doit
   * etre un `<h1>` / `<h2>` ou porter un cran >= `title`. `Link` et `Button` sont les composants qui
   * rendent un `<a>` et un `<button>`.
   */
  const NEVER_DISPLAY = new Set(['button', 'td', 'th', 'label', 'a', 'Link', 'Button']);
  function misplaced({ tag, classes }: { tag: string; classes: string }) {
    if (NEVER_DISPLAY.has(tag)) return true;
    const sized = classes.split(/\s+/).some((c) => DISPLAY_SIZES.has(c));
    return tag !== 'h1' && tag !== 'h2' && !sized;
  }

  it('font-display ne figure que sur un h1, un h2 ou un cran >= title', () => {
    const offenders = SOURCES.flatMap((file) =>
      displayUses(file)
        .filter(misplaced)
        .map(({ tag, classes }) => `${file}: <${tag}> "${classes}"`)
    );
    expect(offenders).toEqual([]);
  });

  it.each(['button', 'td', 'th', 'label', 'a', 'Link', 'Button'])(
    'font-display est refuse sur <%s>, meme en taille de titre',
    (tag) => {
      const uses = displayUsesIn(`const x = <${tag} className="font-display text-heading">x</${tag}>;`);
      expect(uses).toHaveLength(1);
      expect(misplaced(uses[0])).toBe(true);
    }
  );

  it('admet toujours un h1, un h2 et un cran >= title sur un paragraphe', () => {
    for (const html of [
      '<h1 className="font-display text-sm">t</h1>',
      '<h2 className="font-display text-sm">t</h2>',
      '<p className="font-display text-heading">42</p>',
    ]) {
      expect(displayUsesIn(html).filter(misplaced)).toEqual([]);
    }
    expect(displayUsesIn('<p className="font-display text-body">x</p>').filter(misplaced)).toHaveLength(1);
  });

  it('temoin positif : le scanner trouve bien les emplois de font-display', () => {
    // Un `SOURCES` vide, un chemin faux ou une regle de lecture cassee rendraient les gardes ci-dessus
    // vertes sans rien avoir regarde. Le produit en compte plus de trente.
    const found = SOURCES.reduce((n, file) => n + displayUses(file).length, 0);
    expect(found).toBeGreaterThanOrEqual(20);
  });

  /**
   * Le meme piege existe cote CSS : `--font-syne` (alias herite) rend Newsreader. Une regle
   * `font-family: var(--font-syne)` sur un en-tete de tableau ou une etiquette de champ ferait
   * passer un libelle en empattement sans qu'aucun `font-display` ne le signale.
   */
  it('en CSS, la police d’affichage ne sert qu’aux titres', () => {
    const DISPLAY_FACE = /font-family\s*:[^;]*var\(--font-(?:syne|newsreader)/;
    const ALLOWED = ['.font-display', '.doc-prose h2', '.driver-popover-title'];
    const sheets = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .map((f) => join('src', f))
      .filter((f) => f.endsWith('.css'));
    const offenders = sheets.flatMap((sheet) => {
      const css = readFileSync(sheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, , body]) => DISPLAY_FACE.test(body))
        .map(([, selector]) => selector.trim().replace(/\s+/g, ' '))
        .filter((selector) => !ALLOWED.some((a) => selector.includes(a)))
        .map((selector) => `${sheet}: ${selector}`);
    });
    expect(offenders).toEqual([]);
  });
});
