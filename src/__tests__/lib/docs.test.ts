/**
 * Tests de la couche de lecture de la documentation.
 *
 * `extractHeadings` et `parseDoc` sont pures et portent l'essentiel de la
 * couverture ; la couche fichier est mince et n'est vérifiée que par un
 * garde-fou sur le vrai contenu, qui casse si un guide perd son frontmatter.
 */
import path from 'path';
import {
  DOC_CATEGORIES,
  buildSearchIndex,
  extractHeadings,
  getDoc,
  listDocs,
  parseDoc,
} from '@/lib/docs';

const FIXTURES = path.join(process.cwd(), 'src/__tests__/fixtures/docs');

// ── extractHeadings ────────────────────────────────────────────────────────

describe('extractHeadings', () => {
  it('collects h2 and h3 with slugified ids', () => {
    const md = '## Getting started\n\ntext\n\n### Step one\n';
    expect(extractHeadings(md)).toEqual([
      { depth: 2, text: 'Getting started', id: 'getting-started' },
      { depth: 3, text: 'Step one', id: 'step-one' },
    ]);
  });

  it('ignores the h1 title', () => {
    expect(extractHeadings('# Page title\n\n## Real section\n')).toEqual([
      { depth: 2, text: 'Real section', id: 'real-section' },
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    // Les guides contiennent des blocs shell et YAML où "## " apparaît en
    // commentaire : sans suivi des clôtures, le sommaire se remplirait de bruit.
    const md = [
      '## Real section',
      '',
      '```bash',
      '## not a heading',
      '```',
      '',
      '## Second section',
    ].join('\n');
    expect(extractHeadings(md).map((h) => h.text)).toEqual([
      'Real section',
      'Second section',
    ]);
  });

  it('strips inline markdown from heading text', () => {
    expect(extractHeadings('## The `padj` column\n')[0]).toEqual({
      depth: 2,
      text: 'The padj column',
      id: 'the-padj-column',
    });
  });

  it('returns an empty list when there is no heading', () => {
    expect(extractHeadings('just a paragraph\n')).toEqual([]);
  });
});

// ── parseDoc ───────────────────────────────────────────────────────────────

describe('parseDoc', () => {
  const raw = [
    '---',
    'title: Multi-comparison analysis',
    'description: Compare several comparisons at once.',
    'category: analysis',
    'order: 20',
    '---',
    '',
    '# Multi-Comparison Analysis',
    '',
    '## Overview',
    '',
    'body text',
    '',
  ].join('\n');

  it('reads the frontmatter', () => {
    const doc = parseDoc('multi-comparison', raw)!;
    expect(doc.slug).toBe('multi-comparison');
    expect(doc.title).toBe('Multi-comparison analysis');
    expect(doc.description).toBe('Compare several comparisons at once.');
    expect(doc.category).toBe('analysis');
    expect(doc.order).toBe(20);
  });

  it('strips the leading h1 so the page title is not rendered twice', () => {
    const doc = parseDoc('multi-comparison', raw)!;
    expect(doc.content).not.toContain('# Multi-Comparison Analysis');
    expect(doc.content).toContain('## Overview');
    expect(doc.content).toContain('body text');
  });

  it('extracts the headings of the body', () => {
    expect(parseDoc('multi-comparison', raw)!.headings).toEqual([
      { depth: 2, text: 'Overview', id: 'overview' },
    ]);
  });

  it('returns null when the frontmatter has no title', () => {
    // Échec bruyant plutôt que rendu d'un guide sans nom dans l'index.
    const noTitle = '---\ncategory: analysis\n---\n\nbody\n';
    expect(parseDoc('broken', noTitle)).toBeNull();
  });

  it('falls back to the account category and order 999 when absent', () => {
    const minimal = '---\ntitle: Orphan\n---\n\nbody\n';
    const doc = parseDoc('orphan', minimal)!;
    expect(doc.category).toBe('account');
    expect(doc.order).toBe(999);
    expect(doc.description).toBe('');
  });
});

// ── couche fichier ─────────────────────────────────────────────────────────

describe('listDocs', () => {
  it('sorts by category order then by order field', () => {
    expect(listDocs(FIXTURES).map((d) => d.slug)).toEqual([
      'alpha-start',   // getting-started, order 10
      'beta-analysis', // analysis, order 10
      'gamma-account', // account, order 10
    ]);
  });

  it('never exposes a doc with a broken frontmatter', () => {
    expect(listDocs(FIXTURES).map((d) => d.slug)).not.toContain('broken');
  });
});

describe('getDoc', () => {
  it('returns the parsed doc', () => {
    expect(getDoc('beta-analysis', FIXTURES)?.title).toBe('Beta analysis');
  });

  it('returns null on an unknown slug', () => {
    expect(getDoc('does-not-exist', FIXTURES)).toBeNull();
  });

  it('returns null on a slug that escapes the docs directory', () => {
    // Les slugs viennent de generateStaticParams, mais une route dynamique
    // accepte n'importe quoi : un slug traversant lirait un fichier arbitraire.
    expect(getDoc('../../../package', FIXTURES)).toBeNull();
  });
});

describe('buildSearchIndex', () => {
  it('carries title, description, category and section titles', () => {
    const entry = buildSearchIndex(FIXTURES).find((e) => e.slug === 'beta-analysis')!;
    expect(entry.title).toBe('Beta analysis');
    expect(entry.description).toBe('Beta description.');
    expect(entry.category).toBe('analysis');
    expect(entry.headings).toContain('Beta section');
  });
});

// ── garde-fou sur le contenu réel ──────────────────────────────────────────

describe('shipped documentation', () => {
  it('exposes exactly ten guides, all with a valid frontmatter', () => {
    const docs = listDocs();
    expect(docs).toHaveLength(10);
    for (const doc of docs) {
      expect(doc.title).not.toBe('');
      expect(doc.description).not.toBe('');
      expect(DOC_CATEGORIES).toContain(doc.category);
    }
  });

  it('has no duplicate slug', () => {
    const slugs = listDocs().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
