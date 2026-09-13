import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gardes sur le systeme de mouvement.
 *
 * Le mouvement est la partie du systeme qui se degrade le plus vite, parce
 * qu'une cadence en ligne se relit comme une decision locale anodine. Cinq
 * composants declaraient chacun la leur — 40, 60 et 80ms — donc un ecran qui en
 * affichait trois avait trois rythmes concurrents, et personne ne pouvait le
 * voir en lisant un seul fichier.
 */

/** `readdirSync` recursif plutot que `globSync`, qui n'est pas declare dans les types. */
const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__'));

/**
 * La portee `.auth-scope` a sa propre choregraphie, documentee dans
 * globals.css : les ecrans deconnectes ne partagent ni la palette ni le
 * mouvement de l'interieur.
 */
const AUTH_SCOPE = /\/(auth)\/|^src\/app\/page\.tsx$/;

const read = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('choregraphie d’entree', () => {
  /**
   * Le decalage se declare sur le CONTENEUR, en CSS (`data-enter`), et il est
   * borne a cinq crans. En ligne, il ne l'etait pas : `ProjectList` echelonnait
   * les trente projets, donc le dernier arrivait a 1,2s et l'utilisateur
   * attendait une animation au lieu de lire sa liste.
   */
  it('aucun decalage d’animation en style en ligne', () => {
    const offenders = SOURCES.filter((f) => !AUTH_SCOPE.test(f) && /animationDelay/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('le squelette de chargement ne s’echelonne pas', () => {
    // Un squelette annonce une attente ; l'echelonner la met en scene.
    const offenders = SOURCES.filter((f) => {
      const src = read(f);
      return /className="[^"]*\bskeleton\b[^"]*"/.test(src) && /animationDelay/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});

describe('regle de mouvement', () => {
  /**
   * Une carte qui se souleve sous le curseur deplace ce que l'oeil etait en
   * train de lire. Le relief au survol passe par le fond et l'ombre —
   * `gl-card-interactive` — pas par un deplacement.
   *
   * La garde vise l'axe VERTICAL et l'echelle, pas `translate-x` : un chevron
   * qui avance de 2px est une affordance posee sur un element de 16px, il ne
   * deplace aucun contenu. Interdire les deux aurait rendu la garde fausse, et
   * une garde fausse finit en liste d'exceptions.
   */
  it('aucun soulevement ni mise a l’echelle au survol', () => {
    const offenders = SOURCES.filter((f) =>
      /hover:-?(scale-|translate-y-)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * On n'anime jamais une propriete qui declenche une mise en page : largeur,
   * hauteur, marges, position. `transition-all` les embarque toutes sans le
   * dire — c'est la forme la plus courante de la faute.
   */
  it('aucune transition sur une propriete de mise en page', () => {
    const offenders = SOURCES.filter((f) =>
      !AUTH_SCOPE.test(f) && /\btransition-\[(width|height|top|left|margin|padding)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});
