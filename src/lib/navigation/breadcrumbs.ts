/**
 * Fil d'Ariane — table de routes, et non chaine de tests.
 *
 * La TopBar derivait son titre de 19 `if (pathname === …)` successifs, et le
 * resultat tenait en UN mot. Sur sept routes ce mot etait la meme chaine que le
 * <h1> de la page — donc de la duplication, pas seulement du gaspillage. Sur
 * les autres c'etait un nom generique (« Project », « Comparison », « Guide »)
 * qui n'apprenait rien : on savait deja qu'on regardait un projet.
 *
 * Ce module est le REPLI. Il produit toujours une piste d'ariane correcte a
 * partir de l'URL seule, ce qui rend la migration possible route par route :
 * une page qui n'a pas encore de <PageHeader> reste correctement situee. Une
 * page qui en a un enrichit sa derniere miette avec le vrai nom de l'objet
 * (« Skin Study » plutot que « Project ») via useSetBreadcrumb.
 */

export interface Crumb {
  label: string;
  /** Absent sur la derniere miette : on ne lie pas vers la page courante. */
  href?: string;
}

/** Une entree de la table : motif de segments, et les miettes qu'il produit. */
interface Route {
  /** Segments ; `:x` capture, `*` accepte n'importe quoi. */
  pattern: string;
  /** `$1`, `$2`… reprennent les segments captures, decodes. */
  crumbs: { label: string; href?: string }[];
}

/**
 * Ordonnee du plus specifique au plus general : la premiere correspondance
 * gagne. Une comparaison atteinte via une analyse doit donc preceder la
 * comparaison atteinte directement.
 */
const ROUTES: Route[] = [
  { pattern: '/dashboard', crumbs: [{ label: 'Dashboard' }] },
  { pattern: '/projects', crumbs: [{ label: 'Projects' }] },
  { pattern: '/comparisons', crumbs: [{ label: 'Comparisons' }] },
  { pattern: '/profile', crumbs: [{ label: 'Profile' }] },
  { pattern: '/admin', crumbs: [{ label: 'Administration' }] },
  { pattern: '/pricing', crumbs: [{ label: 'Plans' }] },

  { pattern: '/docs', crumbs: [{ label: 'Documentation' }] },
  {
    pattern: '/docs/:slug',
    crumbs: [{ label: 'Documentation', href: '/docs' }, { label: '$1' }],
  },

  { pattern: '/tools', crumbs: [{ label: 'Tools' }] },
  {
    pattern: '/tools/ontology/:id',
    crumbs: [
      { label: 'Tools', href: '/tools' },
      { label: 'Gene Ontology', href: '/tools/ontology' },
      { label: '$1' },
    ],
  },
  {
    pattern: '/tools/ontology',
    crumbs: [{ label: 'Tools', href: '/tools' }, { label: 'Gene Ontology' }],
  },
  {
    pattern: '/tools/power-analysis',
    crumbs: [{ label: 'Tools', href: '/tools' }, { label: 'Power Analysis' }],
  },
  {
    pattern: '/tools/drug-discovery',
    crumbs: [{ label: 'Tools', href: '/tools' }, { label: 'Drug Discovery' }],
  },

  // Une comparaison atteinte via son analyse garde l'analyse dans le chemin.
  {
    pattern: '/projects/:id/analyses/:analysisId/comparisons/:name',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Analysis', href: '/projects/$1/analyses/$2' },
      { label: '$3' },
    ],
  },
  {
    pattern: '/projects/:id/comparisons/:name',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: '$2' },
    ],
  },
  {
    pattern: '/projects/:id/analyses/:analysisId',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Analyses', href: '/projects/$1/analyses' },
      { label: 'Analysis' },
    ],
  },
  {
    pattern: '/projects/:id/analyses/new',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'New analysis' },
    ],
  },
  {
    pattern: '/projects/:id/analyses',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Analyses' },
    ],
  },
  {
    pattern: '/projects/:id/datasets/:datasetId/:view',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Dataset', href: '/projects/$1/datasets/$2' },
      { label: '$3' },
    ],
  },
  {
    pattern: '/projects/:id/datasets/:datasetId',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Dataset' },
    ],
  },
  {
    pattern: '/projects/:id/multi-comparison',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Multi-comparison' },
    ],
  },
  {
    pattern: '/projects/:id/contrast-scatter',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Contrast scatter' },
    ],
  },
  {
    pattern: '/projects/:id/setup',
    crumbs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Project', href: '/projects/$1' },
      { label: 'Setup' },
    ],
  },
  {
    pattern: '/projects/:id',
    crumbs: [{ label: 'Projects', href: '/projects' }, { label: 'Project' }],
  },
];

/** Les identifiants restent bruts ; les noms lisibles arrivent par le contexte. */
function prettify(segment: string): string {
  const decoded = decodeURIComponent(segment);
  // Un nom de comparaison porte son sens : `KO_vs_WT` se lit mieux en « KO vs WT ».
  if (/_vs_/i.test(decoded)) return decoded.replace(/_vs_/i, ' vs ');
  // Un mot ou un slug : `multi-comparison` -> « Multi comparison », `tools` ->
  // « Tools ». Le filtre exclut les chiffres pour ne pas capitaliser un
  // identifiant, qui n'est pas un mot et ne gagne rien a l'etre.
  if (/^[a-z]+(-[a-z]+)*$/.test(decoded)) {
    return decoded.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }
  return decoded;
}

function matchRoute(segments: string[], route: Route): string[] | null {
  const pattern = route.pattern.split('/').filter(Boolean);
  if (pattern.length !== segments.length) return null;
  const captures: string[] = [];
  for (let i = 0; i < pattern.length; i += 1) {
    const p = pattern[i];
    if (p.startsWith(':')) {
      captures.push(segments[i]);
      continue;
    }
    if (p !== segments[i]) return null;
  }
  return captures;
}

const expand = (template: string, captures: string[], pretty: boolean) =>
  template.replace(/\$(\d)/g, (_, n) => {
    const raw = captures[Number(n) - 1] ?? '';
    return pretty ? prettify(raw) : raw;
  });

/**
 * Les miettes d'un chemin. Renvoie toujours au moins une entree ; un chemin
 * inconnu retombe sur ses propres segments plutot que sur rien.
 */
export function resolveBreadcrumb(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];

  for (const route of ROUTES) {
    const captures = matchRoute(segments, route);
    if (!captures) continue;
    return route.crumbs.map(({ label, href }) => ({
      label: expand(label, captures, true),
      href: href ? expand(href, captures, false) : undefined,
    }));
  }

  // Repli : la forme du chemin vaut mieux qu'un libelle generique.
  return segments.map((segment, i) => ({
    label: prettify(segment),
    href: i < segments.length - 1 ? `/${segments.slice(0, i + 1).join('/')}` : undefined,
  }));
}
