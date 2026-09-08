/**
 * `/docs/[slug]` Server Component: the unknown-slug branch.
 *
 * `getDoc` returning null for a slug with no matching guide is already
 * covered in `lib/docs.test.ts`; what isn't covered is the page's own
 * reaction to that null — it must call `notFound()` rather than rendering
 * `DocArticle` with a null doc. `jest.setup.tsx`'s global `next/navigation`
 * mock doesn't export `notFound`, so it's overridden locally here (the
 * global mock still applies to every other suite).
 */
import DocPage from '@/app/docs/[slug]/page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

import { notFound } from 'next/navigation';

it('calls notFound for a slug with no matching guide', async () => {
  await expect(
    DocPage({ params: Promise.resolve({ slug: 'this-guide-does-not-exist' }) })
  ).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledTimes(1);
});
