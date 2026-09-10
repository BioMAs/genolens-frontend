/**
 * La hiérarchie d'action de l'en-tête du projet.
 *
 * L'en-tête alignait sept boutons de même poids — Multi-Comparison, Contrast
 * scatter, Bookmarks, Gene Lists, Custom gene sets, Members — chacun portant
 * la MÊME déclaration de style inline, recopiée six fois. Aucun n'était
 * primaire, et l'action réelle de la page (« New Analysis ») était enterrée
 * dans le rail droit d'un onglet : un utilisateur arrivant sur un projet ne
 * pouvait pas voir quoi faire ensuite.
 *
 * Ce test verrouille la règle : UNE action primaire visible, un secondaire
 * conditionnel, tout le reste dans le menu de dépassement.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/hooks/useAutoTour', () => ({ useAutoTour: jest.fn() }));

let scienceUnlocked = true;
jest.mock('@/hooks/useAddOnModules', () => ({
  useScientificModule: () => ({ unlocked: scienceUnlocked }),
}));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'lea@scilicium.com' } }),
}));

let comparisons: { name: string; dataset_id: string }[] = [];
jest.mock('@/hooks/useProjectData', () => ({
  useProjectSummary: () => ({
    data: {
      // owner_id = u1 : l'utilisateur est proprietaire, donc « Members » existe.
      project: { id: 'p1', name: 'Skin Study', owner_id: 'u1' },
      stats: { total_datasets: 2, original_files_count: 1 },
      comparisons,
    },
    isLoading: false,
  }),
  useProjectDatasets: () => ({ data: [] }),
}));
jest.mock('@/hooks/useAnalyses', () => ({ useAnalyses: () => ({ data: { items: [] } }) }));
jest.mock('@/hooks/useProjectMembers', () => ({ useProjectMembers: () => ({ data: { members: [] } }) }));

// Les gestionnaires ouverts par le menu tirent leurs propres donnees ; ce test
// porte sur la composition de l'en-tete, ils sont reduits a leur identite.
jest.mock('@/components/BookmarkManager', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/GeneListManager', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/CustomGeneSetManager', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ProjectMembersModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ProjectHistory', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/analyses/AnalysisStatusCard', () => ({ __esModule: true, default: () => null }));

import ProjectHub from '@/components/ProjectHub';

beforeEach(() => {
  scienceUnlocked = true;
  comparisons = [];
});

/** L'en-tete : le bloc qui contient le titre du projet. */
function header() {
  return screen.getByRole('heading', { name: 'Skin Study' }).closest('div')!.parentElement!;
}

describe("hiérarchie d'action de l'en-tête", () => {
  it('expose « New analysis » comme unique action primaire', () => {
    render(<ProjectHub projectId="p1" />);

    const cta = within(header()).getByRole('link', { name: /new analysis/i });
    expect(cta).toHaveAttribute('href', '/projects/p1/setup');
  });

  it("garde l'en-tête à deux actions visibles au plus", () => {
    comparisons = [
      { name: 'A_vs_B', dataset_id: 'd1' },
      { name: 'C_vs_D', dataset_id: 'd2' },
    ];
    render(<ProjectHub projectId="p1" />);

    // New analysis + Multi-comparison. Le reste est replie.
    const links = within(header()).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(/new analysis/i);
    expect(links[1]).toHaveAccessibleName(/multi-comparison/i);
  });

  it('ne propose la multi-comparaison qu’à partir de deux comparaisons', () => {
    comparisons = [{ name: 'A_vs_B', dataset_id: 'd1' }];
    render(<ProjectHub projectId="p1" />);

    expect(within(header()).queryByRole('link', { name: /multi-comparison/i })).not.toBeInTheDocument();
  });

  it('replie les outils dans le menu de dépassement', async () => {
    render(<ProjectHub projectId="p1" />);

    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    const menu = screen.getByRole('menu');

    for (const label of ['Bookmarks', 'Gene lists', 'Custom gene sets', 'Members']) {
      expect(within(menu).getByText(label)).toBeInTheDocument();
    }
  });

  it('laisse un outil verrouillé visible mais désactivé, avec sa raison', async () => {
    // Le masquer laisserait croire que la fonctionnalite n'existe pas.
    scienceUnlocked = false;
    render(<ProjectHub projectId="p1" />);

    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    const item = within(screen.getByRole('menu')).getByText('Custom gene sets').closest('[role="menuitem"]')!;

    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('title', expect.stringMatching(/scientific tools add-on/i));
  });

  it("n'offre « Members » qu'au propriétaire", async () => {
    render(<ProjectHub projectId="p1" />);
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(within(screen.getByRole('menu')).getByText('Members')).toBeInTheDocument();
  });
});
