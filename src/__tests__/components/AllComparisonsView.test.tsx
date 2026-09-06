/**
 * The workspace-wide comparisons table.
 *
 * The assertion that earns its keep is the row href. A comparison name is free
 * text — `Cond A / Cond B`, `24h vs 0h` — and an unencoded slash silently
 * produces a URL pointing at a route that does not exist. Everything else here
 * guards the three states a list has to get right: loading, empty, populated.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';

import type { UserComparisonItem } from '@/hooks/useAllComparisons';

let mockResult: {
  data?: unknown;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
} = { data: undefined, isLoading: true, isFetching: false, error: null };

const mockUseAllComparisons = jest.fn(() => mockResult);

jest.mock('@/hooks/useAllComparisons', () => ({
  useAllComparisons: (...args: unknown[]) => mockUseAllComparisons(...(args as [])),
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    data: { items: [{ id: 'p1', name: 'Skin Study' }, { id: 'p2', name: 'Liver Study' }] },
  }),
}));

import AllComparisonsView from '@/components/comparisons/AllComparisonsView';

function makeItem(overrides: Partial<UserComparisonItem> = {}): UserComparisonItem {
  return {
    name: 'treated_vs_control',
    deg_up: 120,
    deg_down: 80,
    deg_total: 200,
    has_enrichment: true,
    dataset_id: 'd1',
    dataset_type: 'SINGLE',
    project_id: 'p1',
    project_name: 'Skin Study',
    dataset_name: 'deg_results.csv',
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function setResponse(comparisons: UserComparisonItem[], extra: Record<string, unknown> = {}) {
  mockResult = {
    data: {
      comparisons,
      total: comparisons.length,
      page: 1,
      page_size: 25,
      total_pages: 1,
      ...extra,
    },
    isLoading: false,
    isFetching: false,
    error: null,
  };
}

beforeEach(() => {
  mockUseAllComparisons.mockClear();
  setResponse([makeItem()]);
});

describe('rows', () => {
  it('shows the comparison, its dataset, its project and its DEG counts', () => {
    setResponse([makeItem()]);
    render(<AllComparisonsView />);

    const row = screen.getByRole('link', { name: /treated_vs_control/ }).closest('tr')!;
    expect(within(row).getByText('deg_results.csv')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Skin Study' })).toHaveAttribute(
      'href',
      '/projects/p1',
    );
    expect(within(row).getByText('120')).toBeInTheDocument();
    expect(within(row).getByText('80')).toBeInTheDocument();
    expect(within(row).getByText('200')).toBeInTheDocument();
  });

  it('links a row to that comparison inside its own project', () => {
    setResponse([makeItem()]);
    render(<AllComparisonsView />);

    expect(screen.getByRole('link', { name: /treated_vs_control/ })).toHaveAttribute(
      'href',
      '/projects/p1/comparisons/treated_vs_control',
    );
  });

  it.each([
    ['Cond A / Cond B', '/projects/p1/comparisons/Cond%20A%20%2F%20Cond%20B'],
    ['24h vs 0h', '/projects/p1/comparisons/24h%20vs%200h'],
    ['KO+drug_vs_WT', '/projects/p1/comparisons/KO%2Bdrug_vs_WT'],
  ])('encodes %s into the row href', (name, expected) => {
    setResponse([makeItem({ name })]);
    render(<AllComparisonsView />);

    expect(screen.getByRole('link', { name: new RegExp(name.replace(/[/+]/g, '\\$&')) })).toHaveAttribute(
      'href',
      expected,
    );
  });

  it('flags enrichment only where it exists', () => {
    setResponse([
      makeItem({ name: 'with_enrichment', has_enrichment: true }),
      makeItem({ name: 'without_enrichment', has_enrichment: false, dataset_id: 'd2' }),
    ]);
    render(<AllComparisonsView />);

    const withRow = screen.getByRole('link', { name: /with_enrichment/ }).closest('tr')!;
    const withoutRow = screen.getByRole('link', { name: /without_enrichment/ }).closest('tr')!;

    expect(within(withRow).getByText('Yes')).toBeInTheDocument();
    expect(within(withoutRow).queryByText('Yes')).not.toBeInTheDocument();
  });

  it('keeps homonymous comparisons from two projects as distinct rows', () => {
    setResponse([
      makeItem({ name: 'shared', project_id: 'p1', project_name: 'Skin Study', dataset_id: 'd1' }),
      makeItem({ name: 'shared', project_id: 'p2', project_name: 'Liver Study', dataset_id: 'd2' }),
    ]);
    render(<AllComparisonsView />);

    const hrefs = screen
      .getAllByRole('link', { name: /shared/ })
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/projects/p1/comparisons/shared',
      '/projects/p2/comparisons/shared',
    ]);
  });
});

describe('states', () => {
  it('renders nothing clickable while loading', () => {
    mockResult = { data: undefined, isLoading: true, isFetching: true, error: null };
    render(<AllComparisonsView />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/no comparisons/i)).not.toBeInTheDocument();
  });

  it('invites the user to their projects when they have no comparisons at all', () => {
    setResponse([]);
    render(<AllComparisonsView />);

    expect(screen.getByText('No comparisons yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to projects/i })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('surfaces a load failure instead of an empty table', () => {
    mockResult = {
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error('Network unreachable'),
    };
    render(<AllComparisonsView />);

    expect(screen.getByText('Network unreachable')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('filters', () => {
  it('asks the API for the default sort on first render', () => {
    setResponse([makeItem()]);
    render(<AllComparisonsView />);

    expect(mockUseAllComparisons).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, sort_by: 'updated_at', sort_order: 'desc' }),
    );
  });

  it('offers every project as a filter option', () => {
    setResponse([makeItem()]);
    render(<AllComparisonsView />);

    const select = screen.getByLabelText('Filter by project');
    expect(within(select).getByRole('option', { name: 'All projects' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Skin Study' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Liver Study' })).toBeInTheDocument();
  });

  it('disables paging when there is a single page', () => {
    setResponse([makeItem()]);
    render(<AllComparisonsView />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('reports the visible range out of the total', () => {
    setResponse([makeItem()], { total: 60, total_pages: 3 });
    render(<AllComparisonsView />);

    expect(screen.getByText('1–1 of 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
});
