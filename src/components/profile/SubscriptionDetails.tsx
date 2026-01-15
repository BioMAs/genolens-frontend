'use client'

import React, { useEffect, useState } from 'react'
import { Check, Zap } from 'lucide-react'
import api from '@/utils/api'

// Define local interface for User Profile based on backend response
interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  subscription_plan: 'BASIC' | 'PREMIUM' | 'ADVANCED'
  ai_interpretations_used: number
  ai_tokens_purchased: number
  ai_tokens_used: number
  is_active: boolean
}

export default function SubscriptionDetails() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/users/me')
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const changePlan = async (plan: string) => {
    setUpdating(true)
    try {
      const { data } = await api.patch('/users/me/subscription', { plan })
      setProfile(data)
    } catch (error) {
      console.error('Error updating plan:', error)
      alert('Failed to update plan')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return (
    <div className="mt-8 p-8 text-center bg-white shadow rounded-lg">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 bg-gray-200 w-1/4 mb-4 rounded"></div>
            <div className="h-32 bg-gray-100 w-full rounded"></div>
        </div>
    </div>
  )

  if (!profile) return (
    <div className="mt-8 p-4 bg-red-50 text-red-700 rounded-lg text-center">
        Failed to load subscription details
    </div>
  )

  const plans = [
    { id: 'BASIC', name: 'Basic', price: 'Free', features: ['Standard Analysis', 'Limited Storage', 'No AI'] },
    { id: 'PREMIUM', name: 'Premium', price: '€29/mo', features: ['15 Free AI Interpretations', 'Priority Support', 'Advanced Filters'] },
    { id: 'ADVANCED', name: 'Advanced', price: '€99/mo', features: ['Unlimited AI', 'Unlimited Storage', 'API Access'] },
  ]

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden mt-8">
      <div className="bg-brand-primary px-4 py-5 sm:px-6 flex items-center justify-between">
        <h3 className="text-lg leading-6 font-medium text-white">Subscription & AI Quota</h3>
        <Zap className="h-6 w-6 text-yellow-300" />
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        
        {/* Current Status */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between">
             <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Current Plan</h4>
                <div className="mt-1 flex items-center">
                    <span className="text-3xl font-bold text-gray-900">{profile.subscription_plan}</span>
                    {profile.role === 'ADMIN' && <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Admin Access</span>}
                </div>
             </div>
             <div className="mt-4 md:mt-0">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">AI Usage</h4>
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-semibold text-gray-900">{profile.ai_interpretations_used}</div>
                        <div className="text-xs text-gray-500">Free Used</div>
                    </div>
                    <div className="h-8 w-px bg-gray-300"></div>
                     <div className="text-center">
                        <div className="text-2xl font-semibold text-gray-900">{profile.ai_tokens_used} / {profile.ai_tokens_purchased}</div>
                        <div className="text-xs text-gray-500">Tokens Used</div>
                    </div>
                </div>
             </div>
           </div>
           
           {/* Progress Bar (Example for Premium) */}
           {profile.subscription_plan === 'PREMIUM' && (
              <div className="mt-4">
                 <div className="flex justify-between text-xs mb-1">
                    <span>Free Quota</span>
                    <span>{15 - profile.ai_interpretations_used} remaining</span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (profile.ai_interpretations_used / 15) * 100)}%` }}></div>
                 </div>
              </div>
           )}
        </div>

        {/* Change Plan */}
        <h4 className="text-lg font-medium text-gray-900 mb-4">Change Subscription</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = profile.subscription_plan === plan.id;
            return (
              <div 
                key={plan.id}
                className={`relative rounded-lg border p-4 shadow-sm flex flex-col ${isCurrent ? 'border-brand-primary ring-2 ring-brand-primary' : 'border-gray-300'}`}
              >
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-2 text-gray-500">{plan.price}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                        <span className="ml-2 text-sm text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => changePlan(plan.id)}
                  disabled={isCurrent || updating}
                  className={`mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm 
                    ${isCurrent 
                        ? 'bg-gray-100 text-gray-500 cursor-default' 
                        : 'bg-brand-primary text-white hover:bg-brand-secondary focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary'
                    } disabled:opacity-50 transition-colors`}
                >
                  {isCurrent ? 'Current Plan' : updating ? 'Updating...' : `Switch to ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-center text-gray-400 font-mono">
           [DEV MODE] This changes your subscription instantly.
        </p>
      </div>
    </div>
  )
}
