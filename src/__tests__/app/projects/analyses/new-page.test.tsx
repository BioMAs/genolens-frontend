/**
 * `/projects/[id]/analyses/new` used to render a launcher that posted to
 * `POST /analyses/upload`, an endpoint the backend never had. The route now
 * only forwards old links and bookmarks to the setup wizard.
 */
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

import NewAnalysisPage from '@/app/projects/[id]/analyses/new/page';
import { redirect } from 'next/navigation';

it('redirects to the setup wizard of the same project', async () => {
  await expect(
    NewAnalysisPage({ params: Promise.resolve({ id: 'p1' }) }),
  ).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/projects/p1/setup');
});
