/**
 * Le layout de `/projects/[id]` pose la barre du projet au-dessus de la page.
 *
 * `ProjectNav` (client) decide seul s'il se rend ; le layout (serveur) ne fait
 * que lui passer l'id, lu dans `params` — une promesse en Next 16 — et rendre
 * la page apres lui.
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/components/project/ProjectNav', () => ({
  __esModule: true,
  default: ({ projectId }: { projectId: string }) => <nav data-testid="project-nav">{projectId}</nav>,
}));

import ProjectLayout from '@/app/projects/[id]/layout';

it('renders the project bar for the awaited id, then the page', async () => {
  const tree = await ProjectLayout({
    params: Promise.resolve({ id: 'p1' }),
    children: <main data-testid="page" />,
  });
  render(tree);

  const nav = screen.getByTestId('project-nav');
  expect(nav).toHaveTextContent('p1');
  const page = screen.getByTestId('page');
  expect(nav.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
