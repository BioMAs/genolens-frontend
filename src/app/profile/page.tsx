import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Calendar, Shield } from 'lucide-react'
import SubscriptionDetails from '@/components/profile/SubscriptionDetails'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-brand-primary px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-white">User Profile</h3>
              <p className="mt-1 max-w-2xl text-sm text-brand-secondary/80">
                Personal details and account information.
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white">
              <User className="h-6 w-6" />
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email address
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {user.email}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> User ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono text-xs">
                  {user.id}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Account Created
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(user.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Last Sign In</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString(undefined, {
                     year: 'numeric',
                     month: 'long',
                     day: 'numeric',
                     hour: '2-digit',
                     minute: '2-digit'
                  }) : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <SubscriptionDetails />
        
        <div className="mt-8 flex justify-center">
           <form action="/auth/signout" method="post">
              <button
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                type="submit"
              >
                Sign Out
              </button>
            </form>
        </div>
      </div>
    </div>
  )
}
