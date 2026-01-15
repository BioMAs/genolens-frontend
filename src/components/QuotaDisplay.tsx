'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { UserProfile } from '@/types'

export default function QuotaDisplay() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="animate-pulse bg-gray-200 h-6 w-20 rounded-full"></div>
  )
  
  if (!profile) return null

  // Admin always has unlimited (conceptually) or just show Infinite
  if (profile.role === 'ADMIN') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Admin (∞)</span>
      </div>
    )
  }

  // Advanced Plan
  if (profile.subscription_plan === 'ADVANCED') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full text-xs font-semibold shadow-sm">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Unlimited</span>
      </div>
    )
  }

  // Calculate remaining credits
  const FREE_QUOTA = 15
  const paidAvailable = profile.ai_tokens_purchased - profile.ai_tokens_used
  const freeUsed = profile.ai_interpretations_used
  const freeRemaining = Math.max(0, FREE_QUOTA - freeUsed)
  
  const totalAvailable = paidAvailable + freeRemaining

  if (totalAvailable <= 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200" title="Quota exceeded">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>0 AI</span>
      </div>
    )
  }
  
  const isLow = totalAvailable <= 3

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      isLow 
        ? 'bg-amber-50 text-amber-700 border-amber-200' 
        : 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20'
    }`} title={`${paidAvailable} Paid + ${freeRemaining} Free`}>
      <Sparkles className={`w-3.5 h-3.5 ${isLow ? 'text-amber-500' : 'text-brand-secondary'}`} />
      <span>{totalAvailable} AI</span>
    </div>
  )
}
