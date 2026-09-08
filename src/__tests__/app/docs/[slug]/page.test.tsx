/**
 * `/docs/[slug]` Server Component : la garde d'authentification et la branche
 * du slug inconnu.
 *
 * `getDoc` returning null for a slug with no matching guide is already
 * covered in `lib/docs.test.ts`; what isn't covered is the page's own
 * reaction to that null — it must call `notFound()` rather than rendering
 * `DocArticle` with a null doc. `jest.setup.tsx`'s global `next/navigation`
 * mock doesn't export `notFound`, so it's overridden locally here (the
 * global mock still applies to every other suite).
 *
 * La garde d'authentification est vérifiée avant `getDoc` : un visiteur
 * anonyme ne doit pas pouvoir distinguer un guide existant d'un slug inconnu,
 * et surtout pas lire le guide.
 */
import DocPage from '@/app/docs/[slug]/page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const getUser = jest.fn();

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser } })),
}));

import { notFound, redirect } from 'next/navigation';

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

it('calls notFound for a slug with no matching guide', async () => {
  await expect(
    DocPage({ params: Promise.resolve({ slug: 'this-guide-does-not-exist' }) })
  ).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledTimes(1);
});

it('redirects an anonymous visitor instead of serving the guide', async () => {
  getUser.mockResolvedValue({ data: { user: null } });

  await expect(DocPage({ params: Promise.resolve({ slug: 'gsea' }) })).rejects.toThrow(
    'NEXT_REDIRECT'
  );
  expect(redirect).toHaveBeenCalledWith('/');
  expect(notFound).not.toHaveBeenCalled();
});

it('serves the guide to a signed-in user', async () => {
  await expect(
    DocPage({ params: Promise.resolve({ slug: 'gsea' }) })
  ).resolves.toBeTruthy();
  expect(redirect).not.toHaveBeenCalled();
  expect(notFound).not.toHaveBeenCalled();
});
