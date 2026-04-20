'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Zap, FolderOpen, HardDrive, ExternalLink, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useBilling, SubscriptionInfo } from '@/hooks/useBilling';

const PLAN_LIMITS = {
  BASIC: { projects: 3, storage: '500 MB', aiInterpretations: 0 },
  PREMIUM: { projects: 20, storage: '10 GB', aiInterpretations: 50 },
  ADVANCED: { projects: Infinity, storage: '50 GB', aiInterpretations: 200 },
} as const;

type PlanKey = keyof typeof PLAN_LIMITS;

function normalizePlan(plan: string): PlanKey {
  const upper = plan.toUpperCase();
  if (upper === 'BASIC' || upper === 'PREMIUM' || upper === 'ADVANCED') {
    return upper as PlanKey;
  }
  return 'BASIC';
}

function PlanBadge({ plan }: { plan: PlanKey }) {
  if (plan === 'ADVANCED') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        Advanced
      </span>
    );
  }
  if (plan === 'PREMIUM') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
        Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      Starter (Free)
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      Inactive
    </span>
  );
}

export default function BillingSection() {
  const { getSubscription, getBillingPortal, loading, error } = useBilling();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    getSubscription()
      .then(setSubscription)
      .catch((err: Error) => setFetchError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const url = await getBillingPortal();
      window.location.href = url;
    } catch {
      // error is already set in the hook
    } finally {
      setPortalLoading(false);
    }
  };

  const planKey = subscription ? normalizePlan(subscription.plan) : 'BASIC';
  const limits = PLAN_LIMITS[planKey];
  const aiUsed = subscription?.ai_interpretations_used ?? 0;
  const aiLimit = limits.aiInterpretations;
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);
  const isPaidPlan = planKey === 'PREMIUM' || planKey === 'ADVANCED';

  return (
    <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-brand-primary px-4 py-5 sm:px-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-white">Subscription &amp; Billing</h3>
          <p className="mt-1 max-w-2xl text-sm text-brand-secondary/80">
            Your current plan and usage details.
          </p>
        </div>
        <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white">
          <CreditCard className="h-6 w-6" />
        </div>
      </div>

      {/* Body */}
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        {fetchError && (
          <div className="flex items-center gap-2 px-6 py-4 text-sm text-red-700 bg-red-50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {loading && !subscription && (
          <div className="px-6 py-8 text-sm text-gray-500 text-center animate-pulse">
            Loading subscription info…
          </div>
        )}

        {subscription && (
          <dl className="sm:divide-y sm:divide-gray-200">
            {/* Current plan */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Current Plan
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center gap-3">
                <PlanBadge plan={planKey} />
                <StatusBadge isActive={subscription.is_active} />
              </dd>
            </div>

            {/* Projects */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> Projects
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {limits.projects === Infinity ? 'Unlimited' : limits.projects}
              </dd>
            </div>

            {/* Storage */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Storage
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {limits.storage}
              </dd>
            </div>

            {/* AI interpretations */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Zap className="h-4 w-4" /> AI Interpretations
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {aiLimit === 0 ? (
                  <span className="text-gray-400">Not included in this plan</span>
                ) : (
                  <>
                    {aiUsed} / {aiLimit} used this month
                    {aiUsed >= aiLimit && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Limit reached
                      </span>
                    )}
                  </>
                )}
              </dd>
            </div>

            {/* Renewal date */}
            {subscription.subscription_ends_at && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(subscription.subscription_ends_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            )}

            {/* Action */}
            <div className="py-4 sm:py-5 sm:px-6">
              {isPaidPlan && hasStripeCustomer ? (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ExternalLink className="h-4 w-4" />
                  {portalLoading ? 'Opening portal…' : 'Manage Billing'}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                >
                  <Zap className="h-4 w-4" />
                  Upgrade Plan
                </Link>
              )}
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
