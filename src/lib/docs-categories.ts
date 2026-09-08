/**
 * Constantes de catégories de documentation.
 *
 * Séparées de `docs.ts` pour rester importables depuis un Client Component
 * (`DocsIndex`) sans entraîner `fs`/`path`/`gray-matter` dans le bundle
 * navigateur : `docs.ts` les ré-exporte pour que son API publique ne change
 * pas pour les Server Components qui l'utilisaient déjà.
 */

export const DOC_CATEGORIES = [
  'getting-started',
  'analysis',
  'enrichment',
  'explore',
  'collaboration',
  'account',
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  'getting-started': 'Getting started',
  analysis: 'Analysis',
  enrichment: 'Enrichment',
  explore: 'Explore',
  collaboration: 'Collaboration',
  account: 'Account',
};
