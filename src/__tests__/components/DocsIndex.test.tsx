/**
 * L'index de `/docs` : groupement par catégorie et filtre client.
 * Le filtre porte sur le titre, la description et les titres de sections —
 * chercher « volcano » doit trouver un guide qui n'en parle qu'en section.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocsIndex from '@/components/docs/DocsIndex';
import type { SearchEntry } from '@/lib/docs';

const DOCS: SearchEntry[] = [
  {
    slug: 'analysis-pipeline',
    title: 'Analysis pipeline',
    description: 'From raw counts to differential expression results.',
    category: 'getting-started',
    order: 10,
    headings: ['Overview', 'Uploading counts'],
  },
  {
    slug: 'deg-filtering',
    title: 'Filtering differential genes',
    description: 'Combine thresholds with AND/OR logic.',
    category: 'analysis',
    order: 10,
    headings: ['The volcano plot', 'Saving a filter'],
  },
  {
    slug: 'gsea',
    title: 'Gene Set Enrichment Analysis',
    description: 'Rank-based enrichment across whole gene sets.',
    category: 'enrichment',
    order: 20,
    headings: ['Running GSEA'],
  },
];

it('renders every guide grouped under its category label', () => {
  render(<DocsIndex docs={DOCS} />);

  expect(screen.getByRole('heading', { name: 'Getting started' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Analysis' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Enrichment' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Analysis pipeline/ })).toHaveAttribute(
    'href',
    '/docs/analysis-pipeline'
  );
});

it('shows no empty category heading', () => {
  render(<DocsIndex docs={DOCS} />);
  expect(screen.queryByRole('heading', { name: 'Collaboration' })).not.toBeInTheDocument();
});

it('filters on the title', async () => {
  render(<DocsIndex docs={DOCS} />);
  await userEvent.type(screen.getByRole('searchbox'), 'filtering');

  expect(screen.getByRole('link', { name: /Filtering differential genes/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Analysis pipeline/ })).not.toBeInTheDocument();
});

it('filters on a section title', async () => {
  render(<DocsIndex docs={DOCS} />);
  await userEvent.type(screen.getByRole('searchbox'), 'volcano');

  expect(screen.getByRole('link', { name: /Filtering differential genes/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Gene Set Enrichment/ })).not.toBeInTheDocument();
});

it('filters case-insensitively on the description', async () => {
  render(<DocsIndex docs={DOCS} />);
  await userEvent.type(screen.getByRole('searchbox'), 'RANK-BASED');

  expect(screen.getByRole('link', { name: /Gene Set Enrichment/ })).toBeInTheDocument();
});

it('tells the reader when nothing matches', async () => {
  render(<DocsIndex docs={DOCS} />);
  await userEvent.type(screen.getByRole('searchbox'), 'zzzznotfound');

  expect(screen.getByText(/no guide matches/i)).toBeInTheDocument();
});
