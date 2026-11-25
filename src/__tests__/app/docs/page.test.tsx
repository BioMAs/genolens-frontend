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

jest.mock('@/utils/auth/server', () => ({ getSessionUser: jest.fn() }));

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/utils/auth/server';

const session = getSessionUser as jest.MockedFunction<typeof getSessionUser>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('redirects an anonymous visitor to the landing page', async () => {
  session.mockResolvedValue(null);

  await expect(DocsPage()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/');
});

it('renders the index for a signed-in user', async () => {
  session.mockResolvedValue({ sub: 'u1', sid: 's1', amr: ['pwd', 'otp'] });

  await expect(DocsPage()).resolves.toBeTruthy();
  expect(redirect).not.toHaveBeenCalled();
});
