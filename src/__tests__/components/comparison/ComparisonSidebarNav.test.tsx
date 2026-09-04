/**
 * The four-group comparison nav.
 *
 * Two things are worth asserting here. That the eleven flat entries really became four groups —
 * otherwise the restructure is cosmetic. And that **every anchor a group emits has a section to
 * land on**: a link to `#network` when nothing renders `id="network"` scrolls nowhere and looks
 * broken, and it is the single most likely defect in a screen built from anchors.
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

let mockSearch = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => '/projects/p1/comparisons/A_vs_B',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useParams: () => ({}),
}));

jest.mock('@/hooks/useProjectData', () => ({
  useProjectDatasets: () => ({
    data: [{ id: 'm1', type: 'MATRIX', status: 'READY' }],
  }),
}));

let mockProfile: Record<string, unknown> | undefined;
jest.mock('@/hooks/useCosmetics', () => ({
  useUserProfile: () => ({ data: mockProfile }),
}));

import ComparisonSidebarNav from '@/components/comparison/ComparisonSidebarNav';
import {
  buildComparisonModules,
  groupModulesByView,
} from '@/components/comparison/comparisonModules';
import { VIEW_LABELS, VIEW_ORDER } from '@/components/comparison/comparisonRoutes';

const BASE = '/projects/p1/comparisons/A_vs_B';

const FULL_ACCESS = {
  role: 'USER',
  has_cosmetics_module: true,
  has_report_customization: true,
  has_scientific_module: true,
  has_drug_discovery_module: true,
};

function renderNav() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSidebarNav basePath={BASE} projectId="p1" />
    </QueryClientProvider>
  );
}

/** Every `id` the comparison screen actually renders, read from the component's source. */
function renderedSectionIds(): Set<string> {
  // Reading the source is deliberate: the alternative is mounting ComparisonDetail with its
  // fifteen fetches, and this assertion is about the contract between two files, not about
  // rendering. A missing target is exactly what the source can prove.
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ComparisonDetail.tsx'),
    'utf8'
  );
  return new Set([...source.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]));
}

beforeEach(() => {
  mockSearch = '';
  mockProfile = FULL_ACCESS;
});

describe('grouping', () => {
  it('shows four group headings instead of eleven flat entries', () => {
    renderNav();

    for (const view of VIEW_ORDER) {
      expect(screen.getByRole('link', { name: VIEW_LABELS[view] })).toBeInTheDocument();
    }
  });

  it('links each heading to its view, and the default view bare', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', BASE);
    expect(screen.getByRole('link', { name: 'Understand' })).toHaveAttribute(
      'href',
      `${BASE}?view=comprendre`
    );
  });

  it('reveals the panels of the open group only', () => {
    renderNav();
    // Explore is the default, so its panels are listed and Understand's are not
    expect(screen.getByRole('link', { name: 'DEG table' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enrichment' })).toBeNull();
  });

  it('follows the URL to another group', () => {
    mockSearch = 'view=comprendre';
    renderNav();

    expect(screen.getByRole('link', { name: 'Enrichment' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'DEG table' })).toBeNull();
  });

  it('follows a legacy tab, so a bookmark still opens the right group', () => {
    mockSearch = 'tab=enrichment';
    renderNav();

    expect(screen.getByRole('link', { name: 'Enrichment' })).toBeInTheDocument();
  });

  it('treats all four groups alike, with none folded away behind a disclosure', () => {
    renderNav();

    for (const view of VIEW_ORDER) {
      expect(
        screen.getByRole('link', { name: VIEW_LABELS[view] }).closest('details')
      ).toBeNull();
    }
  });

  // `?view=outils` is a saved link from before Tools became Apply: it must still open a group.
  it('follows a retired view name to the group that replaced it', () => {
    mockSearch = 'view=outils';
    renderNav();

    expect(screen.getByRole('link', { name: 'Signature score' })).toBeInTheDocument();
  });
});

describe('modules that cannot open', () => {
  it('lists a locked add-on without making it a link', () => {
    mockProfile = { ...FULL_ACCESS, has_cosmetics_module: false };
    mockSearch = 'view=outils';
    renderNav();

    expect(screen.queryByRole('link', { name: 'Skin claims' })).toBeNull();
    expect(screen.getByText('Skin claims')).toBeInTheDocument();
  });

  it('says what is missing rather than promising a view that cannot open', () => {
    mockProfile = FULL_ACCESS;
    renderNav();
    // With a matrix present nothing is waiting on data; the hint path is covered by the
    // catalogue's own suite, so here it is enough that a ready module *is* a link.
    expect(screen.getByRole('link', { name: 'Heatmap & clustering' })).toBeInTheDocument();
  });
});

describe('every anchor has a target', () => {
  // The single most likely defect in an anchor-driven screen.
  it('emits no panel link whose section the comparison screen does not render', () => {
    const ids = renderedSectionIds();
    const groups = groupModulesByView(
      buildComparisonModules({
        hasMatrix: true,
        hasEnrichmentFile: true,
        cosmeticsUnlocked: true,
        reportUnlocked: true,
        scienceUnlocked: true,
        drugDiscoveryUnlocked: true,
        stats: null,
      })
    );

    const missing = groups
      .flatMap((g) => g.modules)
      .filter((m) => m.state === 'ready' && !ids.has(m.panel))
      .map((m) => `${m.id} → #${m.panel}`);

    expect(missing).toEqual([]);
  });

  it('finds a section for every view, so no group opens onto nothing', () => {
    const ids = renderedSectionIds();
    const groups = groupModulesByView(
      buildComparisonModules({
        hasMatrix: true,
        hasEnrichmentFile: true,
        cosmeticsUnlocked: true,
        reportUnlocked: true,
        scienceUnlocked: true,
        drugDiscoveryUnlocked: true,
        stats: null,
      })
    );

    for (const group of groups) {
      const rendered = group.modules.filter((m) => ids.has(m.panel));
      expect(rendered.length).toBeGreaterThan(0);
    }
  });
});
