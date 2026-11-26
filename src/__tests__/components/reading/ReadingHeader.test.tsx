/**
 * L'en-tête de la lecture : le titre, la phrase qui dit ce qui est comparé, la pastille des seuils
 * qui ouvre leur dialogue, et le rapport.
 *
 * L'état des seuils est LUI réel (un `ComparisonSelectionProvider` est monté, et le vrai
 * `ThresholdControl` se trouve dans le dialogue) : ce qu'on vérifie est que la pastille lit ce que
 * le dialogue écrit. Seul le bouton de rapport est simulé : il a ses propres tests, ses requêtes et
 * ses deux fenêtres, et l'en-tête ne fait que le placer.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import ReadingHeader from '@/components/reading/ReadingHeader';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';
import { BreadcrumbProvider, useBreadcrumbOverride } from '@/contexts/BreadcrumbContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { Project } from '@/types';

jest.mock('@/components/ComparisonReportButton', () => ({
  __esModule: true,
  default: (props: { datasetId: string; comparisonName: string }) => (
    <button type="button" data-testid="report-button" data-props={JSON.stringify(props)}>
      Report
    </button>
  ),
}));

const project: Project = {
  id: 'p1',
  name: 'Skin Study',
  owner_id: 'u1',
  species: 'Homo sapiens',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const access: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

const conditions = { a: 'Treated', na: 6, b: 'Control', nb: 5 };

function Crumbs() {
  const crumbs = useBreadcrumbOverride();
  return <output data-testid="crumbs">{JSON.stringify(crumbs)}</output>;
}

/** Un témoin qui écrit les seuils depuis dehors, comme le ferait un lien partagé. */
function SetThresholds() {
  const { setThresholds } = useComparisonActions();
  return (
    <button type="button" onClick={() => setThresholds({ padj: 0.001, logfc: 1 })}>
      set from outside
    </button>
  );
}

const mockOpenReportLayout = jest.fn();

beforeEach(() => mockOpenReportLayout.mockReset());

function renderHeader(
  props: Partial<React.ComponentProps<typeof ReadingHeader>> = {},
  extra?: ReactNode
) {
  return render(
    <BreadcrumbProvider>
      <ComparisonSelectionProvider>
        <ReadingHeader
          projectId="p1"
          project={project}
          decodedName="Treated_vs_Control"
          conditions={conditions}
          access={access}
          degDatasetId="deg-1"
          onOpenReportLayout={mockOpenReportLayout}
          {...props}
        />
        {extra}
        <Crumbs />
      </ComparisonSelectionProvider>
    </BreadcrumbProvider>
  );
}

const chip = (name: string | RegExp = /^Thresholds:/) => screen.getByRole('button', { name });

describe('ReadingHeader — the title and what is compared', () => {
  it('names the page with the comparison, as the one h1', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1, name: 'Treated_vs_Control' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('says which two conditions are compared and how many samples each has', () => {
    renderHeader();
    expect(screen.getByText('Treated (6 samples) against Control (5)')).toBeInTheDocument();
  });

  it('writes no subtitle when the conditions are not known', () => {
    renderHeader({ conditions: null });
    expect(screen.queryByText(/against/)).toBeNull();
    // …and the rest of the header does not depend on it.
    expect(chip()).toBeInTheDocument();
  });
});

describe('ReadingHeader — the breadcrumb', () => {
  it('goes Projects, the project, the comparison', () => {
    renderHeader();
    expect(JSON.parse(screen.getByTestId('crumbs').textContent ?? 'null')).toEqual([
      { label: 'Projects', href: '/projects' },
      { label: 'Skin Study', href: '/projects/p1' },
      { label: 'Treated_vs_Control' },
    ]);
  });

  it('sends the project crumb to the analysis when the comparison is read inside one', () => {
    renderHeader({ analysisId: 'a9' });
    expect(JSON.parse(screen.getByTestId('crumbs').textContent ?? 'null')[1]).toEqual({
      label: 'Skin Study',
      href: '/projects/p1/analyses/a9',
    });
  });
});

describe('ReadingHeader — the thresholds chip', () => {
  it('prints the thresholds of the page', () => {
    renderHeader();
    expect(chip().textContent).toBe('Thresholds: padj < 0.05, |log2FC| > 0.58');
  });

  it('is a button that announces a dialog, and does not submit a form', () => {
    renderHeader();
    expect(chip()).toHaveAttribute('type', 'button');
    expect(chip()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('follows the thresholds when they change elsewhere', async () => {
    renderHeader({}, <SetThresholds />);
    await userEvent.click(screen.getByRole('button', { name: 'set from outside' }));
    expect(chip().textContent).toBe('Thresholds: padj < 0.001, |log2FC| > 1');
  });

  it('opens no dialog until it is clicked', () => {
    renderHeader();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the thresholds dialog, with the control that sets them', async () => {
    renderHeader();
    await userEvent.click(chip());

    const dialog = screen.getByRole('dialog', { name: 'Thresholds' });
    expect(
      // Les processus suivent le seuil du fichier d'enrichissement, pas celui-ci.
      within(dialog).getByText('One setting for every count and chart of this study, kept in this browser.')
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Adjusted p-value threshold')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Absolute log2 fold change threshold')).toBeInTheDocument();
  });

  it('writes what the dialog sets back into the chip', async () => {
    renderHeader();
    await userEvent.click(chip());
    const dialog = screen.getByRole('dialog', { name: 'Thresholds' });

    await userEvent.selectOptions(within(dialog).getByLabelText('Adjusted p-value threshold'), '0.01');
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Absolute log2 fold change threshold'),
      '1.5'
    );

    expect(chip().textContent).toBe('Thresholds: padj < 0.01, |log2FC| > 1.5');
  });

  it('closes with Escape and with the close button, and gives the focus back to the chip', async () => {
    renderHeader();
    await userEvent.click(chip());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chip()).toHaveFocus();

    await userEvent.click(chip());
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReadingHeader — the actions', () => {
  it('has no AI Assistant button and no Reprocess entry', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'AI Assistant' })).toBeNull();
    expect(screen.queryByText(/Reprocess/)).toBeNull();
    expect(screen.queryByRole('button', { name: /more actions|menu/i })).toBeNull();
  });

  it('places the report button, for the dataset and the stored comparison name', () => {
    renderHeader({ actualComparisonName: 'KO_vs_WT' });
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('report-button').dataset.props ?? 'null')).toEqual({
      datasetId: 'deg-1',
      comparisonName: 'KO_vs_WT',
    });
  });

  it('falls back to the name of the page for the report when no stored name is given', () => {
    renderHeader();
    expect(JSON.parse(screen.getByTestId('report-button').dataset.props ?? 'null')).toEqual({
      datasetId: 'deg-1',
      comparisonName: 'Treated_vs_Control',
    });
  });

  it('has no report button before the DEG dataset is known', () => {
    renderHeader({ degDatasetId: null });
    expect(screen.queryByTestId('report-button')).toBeNull();
  });

  it('keeps the report behind the report-customisation lock, as the previous header did', () => {
    renderHeader({ access: { ...access, report: false } });
    expect(screen.queryByTestId('report-button')).toBeNull();
  });

  it('shows no report button while the profile is not loaded', () => {
    renderHeader({
      access: { skin: false, targets: false, science: false, report: false, ai: false, loaded: false },
    });
    expect(screen.queryByTestId('report-button')).toBeNull();
  });

  it('puts a quiet Report layout button next to the report, which opens the layout editor', async () => {
    renderHeader();
    const layout = screen.getByRole('button', { name: 'Report layout' });
    const report = screen.getByRole('button', { name: 'Report' });
    expect(layout.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(layout.className).not.toMatch(/\bborder\b|bg-accent/);
    await userEvent.click(layout);
    expect(mockOpenReportLayout).toHaveBeenCalledTimes(1);
  });

  it('shows no Report layout button without the report module, nor before the profile', () => {
    renderHeader({ access: { ...access, report: false } });
    expect(screen.queryByRole('button', { name: 'Report layout' })).toBeNull();
  });
});
