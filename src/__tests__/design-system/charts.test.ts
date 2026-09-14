import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gardes statiques sur la couche graphique.
 *
 * Elles ne remplacent pas un oeil : elles empechent le 37e fichier de
 * reintroduire dans trois mois un defaut qu'on vient de mesurer et de corriger.
 * Chaque assertion correspond a un defaut qui a REELLEMENT existe ici.
 */

/** `readdirSync` recursif plutot que `globSync` : ce dernier existe a
 *  l'execution mais n'est pas declare dans les types de node:fs. */
const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter(
    (f) =>
      (f.endsWith('.ts') || f.endsWith('.tsx')) &&
      !f.includes('__tests__') &&
      !f.includes('/auth/'),
  );

/**
 * Les commentaires sont retires avant toute recherche. Sans cela, DOCUMENTER un
 * defaut le fait resurgir comme une violation — et la reaction naturelle est
 * alors de supprimer l'explication, ce qui est exactement le contraire de ce
 * qu'on veut. Le test de geometrie fait deja ce choix.
 */
function read(file: string) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('buildPlotlyLayout', () => {
  /**
   * Neuf sites sur cinq fichiers etalaient la fabrique au lieu de lui passer
   * leur mise en page. Les deux sens etaient faux, en miroir :
   *
   *   { ...fabrique, ...a_la_main }  → l'axe ecrit a la main remplace l'objet
   *     entier, donc gridcolor, tickfont et automargin disparaissent ;
   *   { ...a_la_main, ...fabrique }  → la fabrique remplace l'axe entier, donc
   *     `domain`, `autorange` et `margin` disparaissent. Dans
   *     `DEGClusteringView`, la barre laterale des statuts chevauchait la carte
   *     et les genes s'affichaient de bas en haut.
   *
   * La fusion d'un niveau resout les deux — a condition qu'on l'appelle.
   */
  it("n'est jamais etalee, toujours appelee avec sa mise en page", () => {
    const offenders = SOURCES.filter((f) => /\.\.\.buildPlotlyLayout\s*\(/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('echelles de couleur', () => {
  /**
   * Les echelles NOMMEES de Plotly portent un blanc cuit au milieu. En theme
   * sombre, 'RdBu' et 'PiYG' percaient donc un trou blanc au centre de chaque
   * carte de chaleur. `chartScales` rend des stops explicites, theme par theme.
   */
  const NAMED = /colorscale\s*[:=]\s*['"](RdBu|PiYG|Viridis|Portland|Picnic|Jet)['"]/;

  it('aucune echelle nommee de Plotly dans un composant', () => {
    const offenders = SOURCES.filter((f) => f.endsWith('.tsx') && NAMED.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('fonds opaques', () => {
  /**
   * Un fond blanc declare en dur rend un rectangle blanc au milieu d'une
   * application sombre. La fabrique pose `rgba(0,0,0,0)` : le graphique herite
   * du fond de sa carte.
   */
  /**
   * Le banc de verification est exempte NOMMEMENT : son huitieme panneau passe
   * volontairement `paper_bgcolor: 'white'` pour prouver que la fusion l'ecarte.
   * C'est une fixture, pas une page du produit — elle repond 404 en production.
   */
  const BENCH = /^src\/app\/plotly-check\//;

  it("aucun paper_bgcolor / plot_bgcolor 'white'", () => {
    const offenders = SOURCES.filter(
      (f) =>
        !BENCH.test(f) &&
        /(paper|plot)_bgcolor\s*:\s*['"](white|#fff(fff)?)['"]/i.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('convention de direction', () => {
  /**
   * La meme inversion a ete trouvee TROIS fois — ClaimPathwayMap,
   * ClaimPathwayNetwork, le radar d'EnrichmentAnalysis — sous la meme forme :
   *
   *     const UP_COLOR = '#ef4444';   // rouge
   *     const DOWN_COLOR = '#3b82f6'; // bleu
   *
   * Du rouge pour la sur-expression, sous un libelle « UP-regulated », alors
   * que partout ailleurs dans le produit le rouge signifie « sous-exprime ».
   * Un quatrieme fichier pourrait la reintroduire demain ; cette garde vise la
   * forme, pas la teinte, parce que c'est la forme qui se repete.
   *
   * La convention vit dans `chartScales.directionColors`, une seule fois.
   */
  it('aucun composant ne redeclare ses propres couleurs de direction', () => {
    const offenders = SOURCES.filter(
      (f) => !f.startsWith('src/utils/') && /\b(UP|DOWN)_COLOU?R\b/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('utilitaires morts', () => {
  /**
   * En Tailwind v4, un utilitaire de couleur n'est emis que si sa variable de
   * theme existe. `text-muted-foreground` — un reflexe venu de shadcn — etait
   * ecrit dans quatre fichiers alors que `--color-muted-foreground` n'a jamais
   * ete defini ici : verifie contre le CSS compile, la chaine y apparaissait
   * ZERO fois. Le texte heritait donc simplement sa couleur, sans erreur, sans
   * avertissement, et en passant tous les tests.
   *
   * C'est la forme la plus couteuse d'un defaut de style : silencieuse.
   */
  const GHOSTS = ['muted-foreground', 'popover-foreground', 'card-foreground'];

  it.each(GHOSTS)('aucune classe %s (variable de theme inexistante)', (ghost) => {
    const offenders = SOURCES.filter((f) => read(f).includes(ghost));
    expect(offenders).toEqual([]);
  });

  /**
   * Le pendant du fantome : une classe qui EXISTE et qui peint la mauvaise
   * chose. `--color-muted` resout sur `--text-muted`, une ENCRE a 4,83:1 sur
   * blanc. `bg-muted` rendait donc un bandeau gris moyen la ou une surface
   * discrete etait voulue — meme contresens shadcn que `text-muted-foreground`,
   * mais visible celui-la, et pourtant reste huit fois dans le code.
   */
  it('aucun jeton d’encre employe comme fond', () => {
    const offenders = SOURCES.filter((f) => /\bbg-muted\b/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('jetons semantiques', () => {
  /**
   * Toute classe de couleur employee doit correspondre a une variable de theme
   * declaree. C'est la generalisation de la garde des « fantomes » : plutot que
   * d'enumerer les noms venus de shadcn, on verifie la regle qui les rendait
   * morts — en Tailwind v4, un utilitaire de couleur n'existe QUE si sa
   * variable existe, et rien ne le signale quand elle manque.
   *
   * Verifier dans un navigateur ne suffit pas : le serveur de developpement
   * genere par route, donc une classe absente de l'ecran regarde parait
   * manquante alors qu'elle est correcte. C'est un test de source, pas de
   * rendu.
   */
  const CSS = readFileSync('src/app/globals.css', 'utf8');
  const DECLARED = new Set(
    [...CSS.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );

  /** Les familles du produit. Le reste vient de la palette Tailwind. */
  const FAMILIES = ['danger', 'warning', 'success', 'accent', 'ai', 'brand'];
  const USED = new RegExp(
    String.raw`\b(?:bg|text|border|ring|fill|stroke|divide)-((?:${FAMILIES.join('|')})(?:-[a-z]+)*)`,
    'g',
  );

  it('chaque variante semantique employee est declaree dans le theme', () => {
    const missing = new Set<string>();
    for (const file of SOURCES.filter((f) => f.endsWith('.tsx'))) {
      for (const [, name] of read(file).matchAll(USED)) {
        if (!DECLARED.has(name)) missing.add(`${name}  (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('palette Tailwind brute', () => {
  /**
   * Aucune couleur de la palette Tailwind dans une liste de classes.
   *
   * Ce n'etait pas une question de coherence : ces couleurs NE SUIVENT PAS LE
   * THEME. `bg-red-50` vaut #fef2f2 partout, donc chaque panneau d'erreur
   * etait un aplat rose pale au milieu d'une interface sombre. Il y en avait
   * 809 ; la garde existe parce qu'il n'en reste aucune, et qu'une seule
   * suffirait a rouvrir la breche.
   *
   * La portee `.auth-scope` est exclue : elle a sa propre palette, documentee
   * dans globals.css, sans recouvrement avec l'interieur.
   */
  const PALETTE = [
    'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
    'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink',
    'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone',
  ];
  const RAW = new RegExp(
    String.raw`\b(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder|accent|outline|shadow|caret)-(?:${PALETTE.join('|')})-\d{2,3}\b`,
  );
  const CLASS_STRING = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
  const AUTH_SCOPE = /\/auth\/|^src\/app\/page\.tsx$/;

  it('aucune teinte Tailwind brute dans une liste de classes', () => {
    const offenders: string[] = [];
    for (const file of SOURCES.filter((f) => f.endsWith('.tsx') && !AUTH_SCOPE.test(f))) {
      for (const [, , body] of read(file).matchAll(CLASS_STRING)) {
        const hit = RAW.exec(body);
        if (hit) offenders.push(`${hit[0]}  (${file})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
