/**
 * Les trois destinations de la barre du haut.
 *
 * La sidebar en comptait cinq (Dashboard, Projects, Comparisons, Tools,
 * Documentation) plus un sous-menu de projet. La barre du haut n'en garde que
 * trois, parce que les deux autres ne sont pas des endroits ou l'on travaille :
 * les comparaisons appartiennent a un projet, et la documentation vit dans le
 * menu d'aide.
 *
 * Ce module porte AUSSI la regle « quelle destination est allumee ». Elle ne
 * peut pas etre un `startsWith` : /toolsmith allumerait Tools. On compare donc
 * le PREMIER SEGMENT de l'URL, entier, a une table.
 */

export type DestinationKey = 'home' | 'projects' | 'tools';

export interface Destination {
  key: DestinationKey;
  label: 'Home' | 'Projects' | 'Tools';
  href: '/dashboard' | '/projects' | '/tools';
}

/** Dans l'ordre d'affichage. */
export const DESTINATIONS: ReadonlyArray<Destination> = [
  { key: 'home', label: 'Home', href: '/dashboard' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'tools', label: 'Tools', href: '/tools' },
];

/**
 * Premier segment de l'URL -> destination.
 *
 * `/comparisons` est une liste transversale aux projets mais, pour la
 * navigation, elle reste « dans Projects » : c'est la que l'on attend de la
 * retrouver, et il n'y a plus d'entree Comparisons a allumer a sa place.
 *
 * Une `Map` plutot qu'un objet : `/constructor` ou `/__proto__` ne doivent pas
 * resoudre une cle heritee.
 */
const BY_FIRST_SEGMENT: ReadonlyMap<string, DestinationKey> = new Map([
  ['dashboard', 'home'],
  ['projects', 'projects'],
  ['comparisons', 'projects'],
  ['tools', 'tools'],
]);

/**
 * La destination courante, ou `null` quand la route n'en est pas une
 * (/docs, /profile, /admin…) : aucun lien n'est alors allume plutot qu'un lien
 * faux.
 */
export function resolveActiveDestination(pathname: string): DestinationKey | null {
  const firstSegment = pathname.split('/')[1] ?? '';
  return BY_FIRST_SEGMENT.get(firstSegment) ?? null;
}
