/**
 * `/docs` Server Component : la garde d'authentification.
 *
 * Les guides documentent les endpoints internes de l'API (`### Backend API`
 * dans plusieurs d'entre eux). Sans cette garde, la page était pré-rendue en
 * HTML statique et lisible sans compte, contrairement à toutes les autres
 * pages de l'application. `jest.setup.tsx` moque `next/navigation` sans
 * exporter `redirect` : il est donc redéfini localement, comme dans le test
 * de `/docs/[slug]`.
 */
import DocsPage from '@/app/docs/page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const getUser = jest.fn();

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser } })),
}));

import { redirect } from 'next/navigation';

beforeEach(() => {
  jest.clearAllMocks();
});

it('redirects an anonymous visitor to the landing page', async () => {
  getUser.mockResolvedValue({ data: { user: null } });

  await expect(DocsPage()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/');
});

it('renders the index for a signed-in user', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

  await expect(DocsPage()).resolves.toBeTruthy();
  expect(redirect).not.toHaveBeenCalled();
});
