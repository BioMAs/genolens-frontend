import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Mail, Calendar, Shield, Clock, Blocks } from 'lucide-react'
import BillingSection from './BillingSection'
import MyModules from './MyModules'

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
      {/* Account hero */}
      <div className="gl-card flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 place-items-center rounded-full font-display text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--sl-purple), var(--sl-teal-dark))' }}
          >
            {initials}
          </div>
          <div>
            <h1 className="page-title">{name}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--sl-red-dark)', background: 'var(--surface)' }}
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Account details */}
      <section>
        <h2 className="mb-3 font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Account details</h2>
        <div className="gl-card divide-y" style={{ borderColor: 'var(--border)' }}>
          {details.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Icon className="h-4 w-4" /> {label}
              </span>
              <span className={`text-sm ${mono ? 'font-mono text-xs' : 'font-medium'}`} style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add-on modules */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Blocks className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} /> Add-on modules
        </h2>
        <p className="mb-3 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
          Extra capabilities unlocked on your account. Contact your administrator to enable a locked module.
        </p>
        <MyModules />
      </section>

      <BillingSection />
    </div>
  )
}
