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
