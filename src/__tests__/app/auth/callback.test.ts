/** @jest-environment node */
/**
 * `/auth/callback?code=...` used to exchange a Supabase code for a session.
 * Those links are dead now, whatever the query string: whoever still holds one
 * lands on the sign-in page.
 */
import { GET } from '@/app/auth/callback/route';

it('sends old Supabase links home', async () => {
  const res = await GET();

  expect(res.status).toBe(303);
  expect(res.headers.get('location')).toBe('/');
});
