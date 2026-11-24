/**
 * Supabase used to send users back here with a `code` to exchange for a
 * session. Those links are dead: the session is now opened by the API, so
 * whoever still holds one simply lands on the sign-in page.
 *
 * 303 with a relative `Location`: it forces a `GET`, and does not depend on
 * rebuilding the origin behind a proxy.
 */
export async function GET() {
  return new Response(null, { status: 303, headers: { Location: '/' } })
}
