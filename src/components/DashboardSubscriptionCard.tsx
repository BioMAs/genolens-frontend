'use client';

import { useState } from 'react';
import { Sparkles, ExternalLink, ArrowUpCircle, CreditCard, FolderOpen } from 'lucide-react';
import type { SubscriptionInfo } from '@/hooks/useBilling';
import type { UserProfile } from '@/types';
import { useBilling } from '@/hooks/useBilling';
import { Meter } from '@/components/ui/meter';

const FREE_QUOTA = 15;

interface DashboardSubscriptionCardProps {
  subscription?: SubscriptionInfo | null;
  userProfile?: UserProfile | null;
  isLoading?: boolean;
}

function PlanBadge({ plan, role }: { plan: string; role?: string }) {
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
  if (plan === 'ADVANCED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-linear-to-r from-purple-500 to-indigo-500 text-white">
        <Sparkles className="w-3 h-3" />
        Advanced
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
    >
      Free
    </span>
  );
}

function ProjectsBar({ subscription, profile }: { subscription?: SubscriptionInfo | null; profile?: UserProfile | null }) {
  const plan = subscription?.plan ?? profile?.subscription_plan ?? 'FREE';
  const role = profile?.role;
  const count = subscription?.project_count ?? 0;
  const max = subscription?.max_projects ?? null;

  // Unlimited for ADVANCED or ADMIN
  if (plan === 'ADVANCED' || role === 'ADMIN' || max === null) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sl-teal)' }} />
        <span>Unlimited projects</span>
      </div>
    );
  }

  const pct = Math.min(100, (count / max) * 100);
  const isNearLimit = pct >= 80;
  const isAtLimit = count >= max;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1">
          <FolderOpen className="w-3 h-3" />
          Projects
        </span>
        <span style={{ color: isAtLimit ? 'var(--sl-red)' : isNearLimit ? 'var(--sl-orange, #f97316)' : 'var(--text-secondary)' }}>
          {count} / {max} used
        </span>
      </div>
      <Meter
        value={pct / 100}
        tone={isAtLimit ? 'red' : isNearLimit ? 'purple' : 'teal'}
      />
      {isAtLimit && (
        <p className="mt-1 text-xs" style={{ color: 'var(--sl-red)' }}>
          Limit reached — upgrade to create more projects.
        </p>
      )}
    </div>
  );
}

function AiCreditsBar({ subscription, profile }: { subscription?: SubscriptionInfo | null; profile?: UserProfile | null }) {
  const plan = subscription?.plan ?? profile?.subscription_plan ?? 'FREE';

  if (plan === 'ADVANCED') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sl-teal)' }} />
        <span>Unlimited AI interpretations</span>
      </div>
    );
  }

  // Free plan: base quota
  const freeUsed = subscription?.ai_interpretations_used ?? profile?.ai_interpretations_used ?? 0;
  const freeRemaining = Math.max(0, FREE_QUOTA - freeUsed);
  const freePct = Math.min(100, (freeUsed / FREE_QUOTA) * 100);

  // Purchased tokens
  const tokensPurchased = subscription?.ai_tokens_purchased ?? profile?.ai_tokens_purchased ?? 0;
  const tokensUsed = subscription?.ai_tokens_used ?? profile?.ai_tokens_used ?? 0;
  const tokensRemaining = Math.max(0, tokensPurchased - tokensUsed);

  return (
    <div className="space-y-2.5">
      {/* Free quota */}
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
          <span>Free interpretations</span>
          <span style={{ color: freeRemaining <= 3 ? 'var(--sl-red)' : 'var(--text-secondary)' }}>
            {freeRemaining} / {FREE_QUOTA} remaining
          </span>
        </div>
        <Meter value={freePct / 100} tone={freePct >= 90 ? 'red' : 'teal'} />
      </div>

      {/* Purchased tokens (only show if any purchased) */}
      {tokensPurchased > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span>Purchased tokens</span>
            <span>{tokensRemaining} / {tokensPurchased} remaining</span>
          </div>
          <Meter value={Math.min(1, tokensUsed / tokensPurchased)} tone="purple" />
        </div>
      )}
    </div>
  );
}

export default function DashboardSubscriptionCard({
  subscription,
  userProfile,
  isLoading,
}: DashboardSubscriptionCardProps) {
  const { initiateCheckout, getBillingPortal, loading: billingLoading } = useBilling();
  const [redirecting, setRedirecting] = useState(false);

  const plan = subscription?.plan ?? userProfile?.subscription_plan ?? 'FREE';
  const role = userProfile?.role;

  const handleUpgrade = async () => {
    setRedirecting(true);
    try {
      const url = await initiateCheckout('advanced');
      window.location.href = url;
    } finally {
      setRedirecting(false);
    }
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
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

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

      {/* AI credits */}
      <AiCreditsBar subscription={subscription} profile={userProfile} />

      {/* Projects quota */}
      <ProjectsBar subscription={subscription} profile={userProfile} />

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
          {plan === 'ADVANCED' ? (
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
              {redirecting ? 'Redirecting…' : 'Upgrade to Advanced'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
