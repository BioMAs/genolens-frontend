/**
 * Lecture de la bibliothèque de documentation.
 *
 * Seule unité du lot à toucher au système de fichiers, et seulement au build :
 * les pages sont des Server Components générés statiquement. `extractHeadings`
 * et `parseDoc` sont pures pour être testables sans fichiers.
 *
 * Le contenu vit dans ce dépôt et non dans le dépôt parapluie : `frontend` est
 * un submodule construit seul sur Vercel, sans accès au parent.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export { DOC_CATEGORIES, CATEGORY_LABELS, type DocCategory } from './docs-categories';
import { DOC_CATEGORIES, type DocCategory } from './docs-categories';

export interface Heading {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  category: DocCategory;
  order: number;
}

export interface Doc extends DocMeta {
  /** Corps Markdown, titre h1 retiré. */
  content: string;
  headings: Heading[];
}

export interface SearchEntry extends DocMeta {
  headings: string[];
}

const DEFAULT_DIR = path.join(process.cwd(), 'content/docs');

/**
 * Slugs acceptés, aussi bien pour un nom de fichier que pour un segment de
 * route. `readAll` et `getDoc` doivent appliquer le même filtre : sinon un
 * fichier `Single_Cell.md` serait listé sur l'index avec un lien vers une
 * page que le garde-fou de `getDoc` renvoie en 404.
 */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Identifiant d'ancre stable pour un titre de section. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Retire le balisage inline d'un titre : `code`, **gras**, [lien](url). */
function stripInline(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

/**
 * Titres de niveau 2 et 3 du corps.
 *
 * Le suivi des clôtures de blocs de code est nécessaire : les guides
 * contiennent des blocs shell et YAML où « ## » ouvre un commentaire, et le
 * sommaire se remplirait de bruit sans ça.
 *
 * Les ancres sont uniques : plusieurs guides répètent un titre de section
 * (`## Overview` puis `### Overview` dans gsea.md, `### Backend API` deux
 * fois dans multi-comparison.md). Deux `id` égaux renvoient toujours le
 * lecteur au premier des deux, et donnent deux clés React identiques dans le
 * sommaire. Le suffixe suit l'ordre d'apparition ; c'est aussi celui dans
 * lequel `DocArticle` consomme cette liste pour étiqueter les titres rendus.
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    const text = stripInline(match[2]);
    if (!text) continue;

    const base = slugify(text);
    const seen = (used.get(base) ?? 0) + 1;
    used.set(base, seen);

    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      id: seen === 1 ? base : `${base}-${seen}`,
    });
  }

  return headings;
}

/**
 * Retire le premier titre h1 rencontré hors bloc de code.
 *
 * Même suivi de clôtures que `extractHeadings` : un bloc shell ou YAML en
 * tête de guide peut contenir une ligne « # commentaire » qui ne doit pas
 * être confondue avec le titre. Le contenu de la ligne est vidé plutôt que la
 * ligne supprimée, pour rester identique au comportement de l'ancien
 * `content.replace(/^\s*#\s+.*$/m, '')` quand le h1 est la première ligne du
 * corps (cas des dix guides livrés) : l'appelant applique ensuite
 * `trimStart()`.
 */
function stripLeadingH1(markdown: string): string {
  const lines = markdown.split('\n');
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^\s*#\s+.*$/.test(line)) {
      lines[i] = '';
      break;
    }
  }

  return lines.join('\n');
}

/**
 * Parse un guide. Retourne null si le frontmatter n'a pas de titre, ou si le
 * YAML est syntaxiquement invalide — mieux vaut un guide absent de l'index
 * qu'un `next build` cassé par un deux-points mal échappé dans un `title`.
 */
export function parseDoc(slug: string, raw: string): Doc | null {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    return null;
  }
  const { data, content } = parsed;

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) return null;

  const category = DOC_CATEGORIES.includes(data.category as DocCategory)
    ? (data.category as DocCategory)
    : 'account';

  // Le titre est rendu par la page depuis le frontmatter : garder le h1 du
  // corps l'afficherait deux fois.
  const body = stripLeadingH1(content).trimStart();

  return {
    slug,
    title,
    description: typeof data.description === 'string' ? data.description.trim() : '',
    category,
    order: typeof data.order === 'number' ? data.order : 999,
    content: body,
    headings: extractHeadings(body),
  };
}

function readAll(dir: string): Doc[] {
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const docs: Doc[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    // Même filtre que `getDoc` : lister un slug que la page refuse ferait
    // pointer l'index vers une 404.
    const slug = file.replace(/\.md$/, '');
    if (!SLUG_PATTERN.test(slug)) continue;

    const doc = parseDoc(slug, fs.readFileSync(path.join(dir, file), 'utf8'));
    if (doc) docs.push(doc);
  }

  return docs.sort(
    (a, b) =>
      DOC_CATEGORIES.indexOf(a.category) - DOC_CATEGORIES.indexOf(b.category) ||
      a.order - b.order ||
      a.title.localeCompare(b.title)
  );
}

/** Métadonnées de tous les guides, triées par catégorie puis par `order`. */
export function listDocs(dir: string = DEFAULT_DIR): DocMeta[] {
  return readAll(dir).map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    order: doc.order,
  }));
}

/** Un guide, ou null si le slug est inconnu ou traversant. */
export function getDoc(slug: string, dir: string = DEFAULT_DIR): Doc | null {
  // Le slug vient d'une route dynamique, qui accepte n'importe quoi : sans ce
  // filtre, « ../../../package » lirait un fichier arbitraire du dépôt.
  if (!SLUG_PATTERN.test(slug)) return null;

  const file = path.join(dir, `${slug}.md`);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  return parseDoc(slug, raw);
}

/** Index passé au filtre client de la page `/docs`. */
export function buildSearchIndex(dir: string = DEFAULT_DIR): SearchEntry[] {
  return readAll(dir).map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    order: doc.order,
    headings: doc.headings.map((h) => h.text),
  }));
}
