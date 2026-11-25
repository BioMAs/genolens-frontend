/**
 * Les pages gardees (`dashboard`, `projects`, `comparisons`) renvoient un
 * visiteur sans session vers l'accueil, avant de rendre quoi que ce soit.
 *
 * La garde lit le jeton d'acces par `getSessionUser` (verification locale, sans
 * appel a l'API) : une page qui ne montre rien du profil n'a pas besoin du
 * profil. Les vues sont simulees : ce sont des composants clients.
 */
import DashboardPage from '@/app/dashboard/page';
import ProjectsPage from '@/app/projects/page';
import ComparisonsPage from '@/app/comparisons/page';
import { getSessionUser } from '@/utils/auth/server';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/utils/auth/server', () => ({ getSessionUser: jest.fn() }));

jest.mock('@/components/Dashboard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/projects/ProjectsView', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/comparisons/AllComparisonsView', () => ({
  __esModule: true,
  default: () => null,
}));

import { redirect } from 'next/navigation';

const session = getSessionUser as jest.MockedFunction<typeof getSessionUser>;

describe.each([
  ['dashboard', DashboardPage],
  ['projects', ProjectsPage],
  ['comparisons', ComparisonsPage],
])('/%s', (_name, Page) => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects an anonymous visitor to the landing page', async () => {
    session.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('renders for a signed-in user', async () => {
    session.mockResolvedValue({ sub: 'u1', sid: 's1', amr: ['pwd', 'otp'] });

    await expect(Page()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
