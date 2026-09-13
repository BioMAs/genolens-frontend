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
  it("aucun paper_bgcolor / plot_bgcolor 'white'", () => {
    const offenders = SOURCES.filter((f) =>
      /(paper|plot)_bgcolor\s*:\s*['"](white|#fff(fff)?)['"]/i.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});
