/**
 * Rendu d'un guide : titre depuis le frontmatter, corps Markdown, sommaire
 * des sections, navigation précédent/suivant.
 */
import { render, screen } from '@testing-library/react';
import DocArticle from '@/components/docs/DocArticle';
import type { Doc, DocMeta } from '@/lib/docs';

const DOC: Doc = {
  slug: 'multi-comparison',
  title: 'Multi-comparison analysis',
  description: 'Compare several comparisons at once.',
  category: 'analysis',
  order: 20,
  content: '## Overview\n\nCompare **multiple** comparisons.\n\n## Accessing it\n\nSteps here.\n',
  headings: [
    { depth: 2, text: 'Overview', id: 'overview' },
    { depth: 2, text: 'Accessing it', id: 'accessing-it' },
  ],
};

const PREVIOUS: DocMeta = {
  slug: 'deg-filtering',
  title: 'Filtering differential genes',
  description: '',
  category: 'analysis',
  order: 10,
};

const NEXT: DocMeta = {
  slug: 'go-enrichment',
  title: 'Gene Ontology enrichment',
  description: '',
  category: 'enrichment',
  order: 10,
};

it('renders the frontmatter title as the page heading', () => {
  render(<DocArticle doc={DOC} previous={null} next={null} />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Multi-comparison analysis' })
  ).toBeInTheDocument();
});

it('renders the markdown body', () => {
  render(<DocArticle doc={DOC} previous={null} next={null} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();
  expect(screen.getByText('multiple')).toBeInTheDocument();
});

it('renders a table of contents linking to each section', () => {
  render(<DocArticle doc={DOC} previous={null} next={null} />);
  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '#overview');
  expect(screen.getByRole('link', { name: 'Accessing it' })).toHaveAttribute(
    'href',
    '#accessing-it'
  );
});

it('renders previous and next links when given', () => {
  render(<DocArticle doc={DOC} previous={PREVIOUS} next={NEXT} />);
  expect(
    screen.getByRole('link', { name: /Filtering differential genes/ })
  ).toHaveAttribute('href', '/docs/deg-filtering');
  expect(screen.getByRole('link', { name: /Gene Ontology enrichment/ })).toHaveAttribute(
    'href',
    '/docs/go-enrichment'
  );
});

it('omits the previous link on the first guide', () => {
  render(<DocArticle doc={DOC} previous={null} next={NEXT} />);
  expect(screen.queryByText(/^Previous$/)).not.toBeInTheDocument();
  expect(screen.getByText(/^Next$/)).toBeInTheDocument();
});

it('hides the table of contents when the guide has no section', () => {
  render(
    <DocArticle doc={{ ...DOC, headings: [] }} previous={null} next={null} />
  );
  expect(screen.queryByRole('navigation', { name: /on this page/i })).not.toBeInTheDocument();
});

// Regression guard: `textOf` (the helper that computes a heading's DOM id from
// its rendered children) must descend into React elements, not just strings
// and arrays of strings. `extractHeadings` computes ids from the raw Markdown
// text, stripping inline formatting first. When a heading contains inline
// code, bold, or a link, react-markdown hands the h2/h3 override a React
// element for that child (e.g. a `<code>` node) instead of a plain string. If
// `textOf` doesn't recurse into `element.props.children`, it falls through to
// `''`, `slugify('')` produces `''`, and the rendered heading gets `id=""` —
// which does not match the id extractHeadings computed for the same heading,
// so the TOC link for that section points at nothing. Six headings across
// four shipped guides are in this exact shape (e.g. `### \`go_terms\`` in
// go-enrichment.md). Test 3 above only checks the *link's* href against a
// fixture id and would stay green even if this recursion were deleted —
// these two cases assert on the *rendered heading element itself*.
it('gives a heading with inline code the same id its TOC link points to', () => {
  const doc: Doc = {
    ...DOC,
    content: '## The `padj` column\n\nbody\n',
    headings: [{ depth: 2, text: 'The padj column', id: 'the-padj-column' }],
  };
  const { container } = render(<DocArticle doc={doc} previous={null} next={null} />);

  const heading = screen.getByRole('heading', { level: 2, name: /padj/ });
  expect(heading).toHaveAttribute('id', 'the-padj-column');
  expect(container.querySelector('#the-padj-column')).toBe(heading);
  expect(screen.getByRole('link', { name: 'The padj column' })).toHaveAttribute(
    'href',
    '#the-padj-column'
  );
});

it('gives a heading with a bold word and a link the same id its TOC link points to', () => {
  const doc: Doc = {
    ...DOC,
    content: '## **Filtering** by [threshold](https://example.com)\n\nbody\n',
    headings: [
      { depth: 2, text: 'Filtering by threshold', id: 'filtering-by-threshold' },
    ],
  };
  const { container } = render(<DocArticle doc={doc} previous={null} next={null} />);

  const heading = screen.getByRole('heading', { level: 2, name: /Filtering by threshold/ });
  expect(heading).toHaveAttribute('id', 'filtering-by-threshold');
  expect(container.querySelector('#filtering-by-threshold')).toBe(heading);
  expect(screen.getByRole('link', { name: 'Filtering by threshold' })).toHaveAttribute(
    'href',
    '#filtering-by-threshold'
  );
});

// Titre répété dans le même guide : les deux sections doivent porter des
// ancres distinctes, et chaque entrée du sommaire tomber sur la sienne. Sans
// ça le lecteur de gsea.md qui clique le second « Troubleshooting » remonte
// 500 lignes plus haut, sur le premier.
it('gives two identically titled sections distinct ids matching their own TOC links', () => {
  const doc: Doc = {
    ...DOC,
    content: '## Overview\n\nfirst\n\n### Overview\n\nsecond\n',
    headings: [
      { depth: 2, text: 'Overview', id: 'overview' },
      { depth: 3, text: 'Overview', id: 'overview-2' },
    ],
  };
  const { container } = render(<DocArticle doc={doc} previous={null} next={null} />);

  const first = screen.getByRole('heading', { level: 2, name: 'Overview' });
  const second = screen.getByRole('heading', { level: 3, name: 'Overview' });

  expect(first).toHaveAttribute('id', 'overview');
  expect(second).toHaveAttribute('id', 'overview-2');
  expect(container.querySelectorAll('#overview')).toHaveLength(1);
  expect(container.querySelector('#overview')).toBe(first);
  expect(container.querySelector('#overview-2')).toBe(second);

  const links = screen.getAllByRole('link', { name: 'Overview' });
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['#overview', '#overview-2']);
});
