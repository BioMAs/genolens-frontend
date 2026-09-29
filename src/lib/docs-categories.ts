/**
 * Constantes de catégories de documentation.
 *
 * Séparées de `docs.ts` pour rester importables depuis un Client Component
 * (`DocsIndex`) sans entraîner `fs`/`path`/`gray-matter` dans le bundle
 * navigateur : `docs.ts` les ré-exporte pour que son API publique ne change
 * pas pour les Server Components qui l'utilisaient déjà.
 *
 * L'ordre suit le parcours d'un utilisateur, du premier fichier au rapport
 * partagé, et non l'architecture de l'application : c'est aussi l'ordre de
 * l'index et des liens précédent/suivant.
 */

export const DOC_CATEGORIES = [
  'getting-started',
  'data',
  'analysis',
  'explore',
  'enrichment',
  'collaboration',
  'account',
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  'getting-started': 'Getting started',
  data: 'Planning & preparing data',
  analysis: 'Running an analysis',
  explore: 'Exploring results',
  enrichment: 'Biological interpretation',
  collaboration: 'Sharing & exporting',
  account: 'Account & plans',
};
