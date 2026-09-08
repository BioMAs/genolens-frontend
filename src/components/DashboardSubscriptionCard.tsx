'use client';

import { useState } from 'react';
import { Sparkles, ExternalLink, ArrowUpCircle, CreditCard, GitCompare, Check, Lock, FlaskConical, FileText, Pill } from 'lucide-react';
import type { SubscriptionInfo } from '@/hooks/useBilling';
import type { UserProfile } from '@/types';
import { useBilling } from '@/hooks/useBilling';
import { normalizePlan } from '@/utils/plan';
import { usePricing } from '@/hooks/usePricing';
import { findPlan, plansOrdered } from '@/types/pricing';

interface DashboardSubscriptionCardProps {
  subscription?: SubscriptionInfo | null;
  userProfile?: UserProfile | null;
  isLoading?: boolean;
}

function PlanBadge({ plan, role }: { plan: string; role?: string }) {
  const { data: grid } = usePricing();

  if (role === 'ADMIN') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        <Sparkles className="w-3 h-3" />
        Admin (∞)
      </span>
    );
  }

  // The plan's commercial name comes from the grid — the only naming authority.
  // This badge used to label every non-TEAM plan "Free", so a Starter customer
  // paying €100/month was told they were on a free tier.
  const gridPlan = findPlan(grid, plan);
  const label = gridPlan?.name_en ?? normalizePlan(plan);
  // Highlight anything above the entry tier, without hard-coding which that is.
  const isEntryTier = !!grid && !!gridPlan && plansOrdered(grid)[0]?.id === gridPlan.id;

  if (gridPlan && !isEntryTier) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-linear-to-r from-purple-500 to-indigo-500 text-white">
        <Sparkles className="w-3 h-3" />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
    >
      {label}
    </span>
  );
}

function UnlockedModules({ profile }: { profile?: UserProfile | null }) {
  const role = profile?.role;
  const isAdmin = role === 'ADMIN' || role === 'SCILICIUM_ADMIN';

  const modules = [
    { label: 'AI', icon: <Sparkles className="w-3 h-3" />, unlocked: isAdmin || (profile?.can_use_ai ?? false) },
    { label: 'Multi-compare', icon: <GitCompare className="w-3 h-3" />, unlocked: isAdmin || (profile?.can_use_multi_comparison ?? false) },
    { label: 'Export', icon: <FileText className="w-3 h-3" />, unlocked: isAdmin || (profile?.can_export_advanced ?? false) },
    { label: 'Cosmetics', icon: <FlaskConical className="w-3 h-3" />, unlocked: isAdmin || (profile?.has_cosmetics_module ?? false) },
    { label: 'Reports', icon: <FileText className="w-3 h-3" />, unlocked: isAdmin || (profile?.has_report_customization ?? false) },
    { label: 'Science', icon: <FlaskConical className="w-3 h-3" />, unlocked: isAdmin || (profile?.has_scientific_module ?? false) },
    { label: 'Drug discovery', icon: <Pill className="w-3 h-3" />, unlocked: isAdmin || (profile?.has_drug_discovery_module ?? false) },
  ];

  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Features</p>
      <div className="flex flex-wrap gap-1.5">
        {modules.map((mod) => (
          <span
            key={mod.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={mod.unlocked
              ? { background: 'var(--sl-teal-light)', color: 'var(--sl-teal-dark)' }
              : { background: 'var(--surface-raised)', color: 'var(--text-muted)' }
            }
          >
            {mod.unlocked ? <Check className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
            {mod.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardSubscriptionCard({
  subscription,
  userProfile,
  isLoading,
}: DashboardSubscriptionCardProps) {
  const { getBillingPortal, loading: billingLoading } = useBilling();
  const [redirecting, setRedirecting] = useState(false);

  const plan = subscription?.plan ?? userProfile?.subscription_plan ?? 'STARTER';
  const role = userProfile?.role;
  const { data: grid } = usePricing();

  // The tier above the current one, derived from the grid rather than named in
  // code — the label used to read "Upgrade to Advanced", a plan that no longer
  // exists. A plan quoted per deal is skipped: there is nothing to self-serve.
  const currentOrder = findPlan(grid, plan)?.order;
  const nextTier = grid && currentOrder != null
    ? plansOrdered(grid).find((p) => p.order > currentOrder && p.price_monthly != null)
    : undefined;

  // Only an existing Stripe customer has a portal to manage.
  const hasBillingPortal = !!subscription?.stripe_customer_id;

  // Upgrades go through /pricing, the one flow that works end to end.
  //
  // This used to call initiateCheckout('advanced'). 'advanced' is not a value
  // of any plan enum — not PlanKey, not the admin list, not the backend's
  // SubscriptionPlan — so the backend rejected it with 400 and the dashboard's
  // only upgrade button was dead. It also competed with the pricing page's
  // email-request flow. Stripe checkout stays available via useBilling for
  // when per-plan prices are wired up.
  const handleUpgrade = () => {
    window.location.href = '/pricing';
  };

  const handleManageBilling = async () => {
    setRedirecting(true);
    try {
      const url = await getBillingPortal();
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setRedirecting(false);
    }
  };

  // Skeleton
  if (isLoading) {
    return (
      <div className="gl-card p-5 h-full space-y-3">
        <div className="skeleton rounded-md" style={{ height: '20px', width: '40%' }} />
        <div className="skeleton rounded-md" style={{ height: '14px', width: '70%' }} />
        <div className="skeleton rounded-full" style={{ height: '6px' }} />
        <div className="skeleton rounded-md" style={{ height: '32px' }} />
      </div>
    );
  }

  const subsStart = subscription?.subscription_starts_at;
  const subsEnd = subscription?.subscription_ends_at;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="gl-card p-5 h-full flex flex-col gap-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" style={{ color: 'var(--sl-purple)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            My Plan
          </span>
        </div>
        <PlanBadge plan={plan} role={role} />
      </div>

      {/* Les quotas ne sont plus ici : ils vivent dans <QuotaMeters />, en
          position primaire sur le dashboard. Les repeter dans cette carte
          donnait deux chiffres pour la meme grandeur — et celui d'ici etait
          faux, faute d'etre servi par /billing/subscription. */}

      {/* Unlocked features */}
      <UnlockedModules profile={userProfile} />

      {/* Dates */}
      {(subsStart || subsEnd) && (
        <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
          {subsStart && <div>Started: {fmt(subsStart)}</div>}
          {subsEnd && <div>Renews: {fmt(subsEnd)}</div>}
        </div>
      )}

      {/* CTA — hidden for admin */}
      {role !== 'ADMIN' && (
        <div className="mt-auto">
          {hasBillingPortal ? (
            <button
              onClick={handleManageBilling}
              disabled={billingLoading || redirecting}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
              style={{
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage Billing
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={billingLoading || redirecting}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all"
              style={{ background: 'var(--sl-purple)' }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
              }
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              {redirecting ? 'Redirecting…' : nextTier ? `Upgrade to ${nextTier.name_en}` : 'Upgrade plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
