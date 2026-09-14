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
