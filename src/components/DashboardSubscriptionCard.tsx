'use client';

import { useState } from 'react';
import { Sparkles, ExternalLink, ArrowUpCircle, CreditCard, FolderOpen, GitCompare, Check, Lock, FlaskConical, FileText } from 'lucide-react';
import type { SubscriptionInfo } from '@/hooks/useBilling';
import type { UserProfile } from '@/types';
import { useBilling } from '@/hooks/useBilling';
import { Meter } from '@/components/ui/meter';
import { normalizePlan, isPrivilegedRole } from '@/utils/plan';

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
  if (normalizePlan(plan) === 'ON_PREMISE' || normalizePlan(plan) === 'TEAM') {
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

/** Circular SVG arc gauge. radius=28 → circumference≈175.9 */
function ArcGauge({ pct, tone }: { pct: number; tone: 'teal' | 'purple' | 'red' }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct / 100)));
  const color: Record<string, string> = {
    teal: 'var(--sl-teal)',
    purple: 'var(--sl-purple)',
    red: 'var(--sl-red)',
  };
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-raised)" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color[tone]} strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset .4s ease' }}
      />
    </svg>
  );
}

function AiCreditsBar({ subscription, profile }: { subscription?: SubscriptionInfo | null; profile?: UserProfile | null }) {
  const plan = subscription?.plan ?? profile?.subscription_plan ?? 'STARTER';

  if (normalizePlan(plan) === 'ON_PREMISE' || normalizePlan(plan) === 'TEAM') {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-raised)' }}>
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--sl-teal)' }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>AI interpretations</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Unlimited</p>
        </div>
      </div>
    );
  }

  const freeUsed = subscription?.ai_interpretations_used ?? profile?.ai_interpretations_used ?? 0;
  const freeRemaining = Math.max(0, FREE_QUOTA - freeUsed);
  const freePct = Math.min(100, (freeUsed / FREE_QUOTA) * 100);
  const tone = freePct >= 90 ? 'red' : 'teal';

  const tokensPurchased = subscription?.ai_tokens_purchased ?? profile?.ai_tokens_purchased ?? 0;
  const tokensUsed = subscription?.ai_tokens_used ?? profile?.ai_tokens_used ?? 0;
  const tokensRemaining = Math.max(0, tokensPurchased - tokensUsed);

  return (
    <div className="space-y-2.5">
      {/* Arc gauge + stat */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <ArcGauge pct={freePct} tone={tone} />
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: '1px' }}>
            <span className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{freeRemaining}</span>
            <span className="text-[9px] leading-none" style={{ color: 'var(--text-muted)' }}>left</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>AI interpretations</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {freeUsed} used · {freeRemaining} / {FREE_QUOTA} remaining
          </p>
          {freeRemaining <= 3 && (
            <p className="text-xs mt-1" style={{ color: 'var(--sl-red)' }}>Almost out — upgrade for more.</p>
          )}
        </div>
      </div>

      {/* Purchased tokens */}
      {tokensPurchased > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" />Purchased tokens</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{tokensRemaining} / {tokensPurchased}</span>
          </div>
          <Meter value={Math.min(1, tokensUsed / tokensPurchased)} tone="purple" height={8} />
        </div>
      )}
    </div>
  );
}

function StatBar({
  icon,
  label,
  used,
  max,
  unlimited,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  max?: number | null;
  unlimited?: boolean;
}) {
  if (unlimited || max === null || max === undefined) {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {icon}{label}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--sl-teal)' }}>∞</span>
      </div>
    );
  }
  const pct = Math.min(100, (used / max) * 100);
  const isNear = pct >= 80;
  const isAt = used >= max;
  const tone = isAt ? 'red' : isNear ? 'purple' : 'teal';
  const valueColor = isAt ? 'var(--sl-red)' : isNear ? 'var(--sl-orange, #f97316)' : 'var(--text-primary)';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {icon}{label}
        </span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: valueColor }}>
          {used} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {max}</span>
        </span>
      </div>
      <Meter value={pct / 100} tone={tone} height={8} />
      {isAt && (
        <p className="mt-1 text-xs" style={{ color: 'var(--sl-red)' }}>Limit reached — upgrade to continue.</p>
      )}
    </div>
  );
}

function ProjectsBar({ subscription, profile }: { subscription?: SubscriptionInfo | null; profile?: UserProfile | null }) {
  const plan = subscription?.plan ?? profile?.subscription_plan ?? 'STARTER';
  const role = profile?.role;
  const count = subscription?.project_count ?? 0;
  const max = subscription?.max_projects ?? null;
  const unlimited = normalizePlan(plan) !== 'STARTER' || isPrivilegedRole(role) || max === null;

  return (
    <StatBar
      icon={<FolderOpen className="w-3.5 h-3.5" />}
      label="Projects"
      used={count}
      max={max}
      unlimited={unlimited}
    />
  );
}

function ComparisonsBar({ profile }: { profile?: UserProfile | null }) {
  const used = profile?.comparisons_used_this_month ?? 0;
  const quota = profile?.comparisons_quota ?? null;

  return (
    <StatBar
      icon={<GitCompare className="w-3.5 h-3.5" />}
      label="Analyses / month"
      used={used}
      max={quota}
      unlimited={quota === null || quota === undefined}
    />
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
  const { initiateCheckout, getBillingPortal, loading: billingLoading } = useBilling();
  const [redirecting, setRedirecting] = useState(false);

  const plan = subscription?.plan ?? userProfile?.subscription_plan ?? 'STARTER';
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

      {/* Analyses quota */}
      <ComparisonsBar profile={userProfile} />

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
          {normalizePlan(plan) !== 'STARTER' ? (
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
