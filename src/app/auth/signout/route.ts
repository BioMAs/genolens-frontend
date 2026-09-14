import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function POST() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  revalidatePath('/', 'layout')

  // 303 et non `redirect()` de next/navigation : celui-ci repond 307, qui
  // conserve la methode, donc le navigateur re-POSTait la page d'accueil. Le
  // 303 force le GET et laisse une entree d'historique rejouable. Location
  // relative pour ne dependre d'aucune reconstruction d'origine derriere proxy.
  return new Response(null, { status: 303, headers: { Location: '/' } })
}
