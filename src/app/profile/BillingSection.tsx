'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Zap, FolderOpen, HardDrive, ExternalLink, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useBilling, SubscriptionInfo } from '@/hooks/useBilling';
import { normalizePlan } from '@/utils/plan';
import { usePricing } from '@/hooks/usePricing';
import { findPlan, plansOrdered, resolveLimit, type PricingGrid } from '@/types/pricing';

// Quotas and plan names come from GET /pricing. This file used to carry its own
// copy of the limits, which meant any backend change silently desynced this
// page — and it was one of four competing plan-name tables in the frontend.
// `null` = unlimited, matching both the API and the grid.

function PlanBadge({ plan, grid }: { plan: string; grid?: PricingGrid }) {
  const gridPlan = findPlan(grid, plan);
  const label = gridPlan?.name_en ?? normalizePlan(plan);
  // Tone by position in the grid, so adding a tier needs no code change here.
  const order = gridPlan?.order ?? 1;
  const tone =
    order >= 3
      ? 'bg-purple-100 text-purple-800'
      : order === 2
        ? 'bg-teal-100 text-teal-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
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
  const { getSubscription, getBillingPortal, error } = useBilling();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    setIsFetching(true);
    getSubscription()
      .then(setSubscription)
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setIsFetching(false));
  }, [getSubscription]);

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

  const { data: grid } = usePricing();
  const planKey = subscription ? normalizePlan(subscription.plan) : 'STARTER';
  const gridPlan = findPlan(grid, subscription?.plan ?? planKey)
    ?? (grid ? plansOrdered(grid)[0] : undefined);

  // Prefer the live values the API already sends over the grid's list value:
  // an account can be on a negotiated cap. null = unlimited in both.
  const maxProjects = subscription?.max_projects
    ?? (gridPlan ? resolveLimit(gridPlan.max_projects) : null);
  const comparisonsQuota = gridPlan ? resolveLimit(gridPlan.contrast_quota) : null;
  const quotaPeriod = gridPlan?.quota_period ?? 'monthly';

  const aiUsed = subscription?.ai_interpretations_used ?? 0;
  const aiMode = gridPlan?.entitlements?.ai_interpretation;
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);
  // A plan is paid if the grid lists a price for it. Starter is €100/month, so
  // excluding it here (as the hard-coded TEAM/ON_PREMISE test did) denied a
  // paying customer their billing portal — the same mistake as labelling them
  // "Free". Still gated on actually having a Stripe customer to manage.
  const isPaidPlan = gridPlan != null
    && (gridPlan.price_monthly != null || gridPlan.price_annual != null);

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

        {isFetching && (
          <div className="px-6 py-8 text-sm text-gray-500 text-center animate-pulse">
            Loading subscription info…
          </div>
        )}

        {subscription?.status === "pending" && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 mb-4 mx-4 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Account pending activation.</strong> Check your email for an invitation link.
            </p>
          </div>
        )}
        {subscription?.status === "cancelled" && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 mx-4 mt-4">
            <p className="text-red-800 text-sm">
              <strong>Subscription expired.</strong>{" "}
              <a href="/pricing" className="underline font-medium">Renew now</a> to continue using GenoLens.
            </p>
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
                <PlanBadge plan={subscription.plan ?? planKey} grid={grid} />
                <StatusBadge isActive={subscription.is_active} />
              </dd>
            </div>

            {/* Projects */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> Max projects
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {maxProjects === null ? 'Unlimited' : maxProjects}
              </dd>
            </div>

            {/* Monthly comparisons */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Analyses / {quotaPeriod === 'annual' ? 'year' : 'month'}
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {comparisonsQuota === null ? 'Unlimited' : comparisonsQuota}
              </dd>
            </div>

            {/* AI interpretations */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Zap className="h-4 w-4" /> AI Interpretations
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {aiMode === 'none' ? (
                  <span className="text-gray-400">Not included in this plan</span>
                ) : aiMode === 'metered_a_la_carte' ? (
                  <>Billed per report — {aiUsed} generated</>
                ) : aiMode === 'quota' ? (
                  <>Unlimited — {aiUsed} used this month</>
                ) : (
                  <span className="text-gray-400">—</span>
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
