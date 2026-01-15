import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <div className="mx-auto max-w-7xl py-8 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            <Dashboard />
          </div>
        </div>
      </main>
    </div>
  )
}
