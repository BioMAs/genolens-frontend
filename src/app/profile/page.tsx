import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Mail, Calendar, Shield, Clock, Blocks } from 'lucide-react'
import BillingSection from './BillingSection'
import UsageSection from './UsageSection'
import MyModules from './MyModules'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/cn';

function fmt(date?: string | null) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const name = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User'
  const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'U'

  const details = [
    { icon: Mail, label: 'Email address', value: user.email ?? '—' },
    { icon: Shield, label: 'User ID', value: user.id, mono: true },
    { icon: Calendar, label: 'Account created', value: fmt(user.created_at) },
    { icon: Clock, label: 'Last sign in', value: fmt(user.last_sign_in_at) },
  ]

  return (
    <div className="page-container space-y-6">
      {/* Le titre de l'ecran etait enferme dans une carte, precede d'une
          pastille en DEGRADE violet→teal. C'est le meme artefact que celui
          retire du pied de la barre laterale : le dernier degrade de
          l'application connectee. Un cercle plat sur l'accent le remplace, et
          le titre remonte au niveau d'un titre de page.

          `titleVariant="name"` : c'est un nom saisi, pas un intitule du
          produit. */}
      <PageHeader
        title={name}
        titleVariant="name"
        crumbs={[{ label: 'Profile' }]}
        meta={
          <span className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-pill bg-accent-soft font-display text-body-sm text-accent-ink">
              {initials}
            </span>
            <span className="text-body-sm text-secondary">{user.email}</span>
          </span>
        }
        actions={[
          {
            node: (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="h-9 rounded-control border border-strong bg-surface px-4 text-body-sm font-semibold text-danger-ink transition-colors hover:bg-hover"
                >
                  Sign out
                </button>
              </form>
            ),
          },
        ]}
      />

      {/* Account details */}
      <section>
        <h2 className="mb-3 font-display text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Account details</h2>
        <div className="gl-card divide-y" style={{ borderColor: 'var(--border)' }}>
          {details.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="flex items-center gap-2 text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                <Icon className="h-4 w-4" /> {label}
              </span>
              <span className={cn('text-body-sm', mono ? 'font-mono text-caption' : 'font-medium')} style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add-on modules */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 font-display text-body font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Blocks className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} /> Add-on modules
        </h2>
        <p className="mb-3 text-caption" style={{ color: 'var(--text-secondary)' }}>
          Extra capabilities unlocked on your account. Contact your administrator to enable a locked module.
        </p>
        <MyModules />
      </section>

      {/* Usage avant facturation : « ce qu'il me reste » se lit plus souvent
          que « comment je paie ». */}
      <UsageSection />

      <BillingSection />
    </div>
  )
}
