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
 * La garde ne signale que ce qu'elle peut PROUVER.
 *
 * `` `nav-item${actif ? ' active' : ''}` `` est correct : l'espace vit dans la
 * branche. Un regex ne sait pas lire toutes les branches d'une expression
 * quelconque, donc la garde se limite a la forme ou les deux conditions sont
 * visibles sur la ligne — une classe collee a `${`, ET une branche litterale
 * qui commence par une lettre au lieu d'une espace. C'est exactement la forme
 * des cinq occurrences trouvees.
 *
 * Elargir au-dela signalerait des fichiers sains, et une garde fausse finit en
 * liste d'exceptions. La regle plus forte — toute liste de classes passe par
 * `cn()` — vaudrait mieux, mais elle demande de convertir 123 sites : c'est un
 * chantier, pas un garde-fou.
 */
const GLUED_OPEN = /className=\{`[^`\n]*[A-Za-z0-9\-/]\$\{[^`\n]*?\?\s*'[A-Za-z]/;
const GLUED_CLOSE = /className=\{`[^`\n]*\}[A-Za-z][A-Za-z0-9-]/;

describe('interpolation dans une liste de classes', () => {
  it('aucune classe collee a une interpolation', () => {
    const offenders = SOURCES.filter((f) => {
      const src = read(f);
      return GLUED_OPEN.test(src) || GLUED_CLOSE.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
