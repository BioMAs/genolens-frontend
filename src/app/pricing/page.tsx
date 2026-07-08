'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import { useBilling } from '@/hooks/useBilling';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

type PlanKey = 'STARTER' | 'TEAM' | 'ON_PREMISE';
type BillingCycle = 'monthly' | 'annual';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface PlanConfig {
  key: PlanKey;
  displayName: string;
  monthlyPrice: string;
  annualPrice: string;
  annualMonthlyEquiv: string;
  priceNote: string;
  engagement: string;
  description: string;
  features: PlanFeature[];
  ctaLabel: string;
  highlight: boolean;
  isOnPremise?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    key: 'STARTER',
    displayName: 'Starter',
    monthlyPrice: '€100',
    annualPrice: '€1,000',
    annualMonthlyEquiv: '≈ €83 / month',
    priceNote: '/ month',
    engagement: 'Monthly or annual billing',
    description: 'Get started with RNA-seq analysis and all the essential features you need.',
    highlight: false,
    ctaLabel: 'Get started with Starter',
    features: [
      { label: '5 datasets', included: true },
      { label: 'Differential expression analysis', included: true },
      { label: 'Basic clustering (K-means)', included: true },
      { label: 'GO enrichment (Biological Process)', included: true },
      { label: 'Volcano plot & heatmap export', included: true },
      { label: '6-month data retention', included: true },
      { label: 'Community forum support', included: true },
      { label: 'AI interpretation', included: false },
      { label: 'GSEA', included: false },
      { label: 'API access', included: false },
      { label: 'Team collaboration', included: false },
    ],
  },
  {
    key: 'TEAM',
    displayName: 'Pro',
    monthlyPrice: '€250',
    annualPrice: '€2,500',
    annualMonthlyEquiv: '≈ €208 / month',
    priceNote: '/ month',
    engagement: 'Monthly or annual billing',
    description: 'For researchers and postdocs with advanced analytical needs and higher data volumes.',
    highlight: true,
    ctaLabel: 'Upgrade to Pro',
    features: [
      { label: '25 datasets', included: true },
      { label: 'Multi-contrast differential analysis', included: true },
      { label: 'Full clustering suite (K-means, hierarchical)', included: true },
      { label: 'GO + KEGG + Reactome enrichment', included: true },
      { label: 'GSEA with leading-edge analysis', included: true },
      { label: 'AI interpretation (50 reports / month)', included: true },
      { label: 'REST API (120 req/min)', included: true },
      { label: '1-year data retention', included: true },
      { label: 'Email support (48h)', included: true },
      { label: 'Team collaboration', included: true },
      { label: 'Custom gene sets', included: true },
    ],
  },
  {
    key: 'ON_PREMISE',
    displayName: 'Enterprise',
    monthlyPrice: 'On request',
    annualPrice: 'On request',
    annualMonthlyEquiv: '',
    priceNote: '',
    engagement: 'Fully custom terms',
    description: 'For labs, institutions and organisations with specific requirements. Fully custom.',
    highlight: false,
    ctaLabel: 'Contact sales',
    isOnPremise: true,
    features: [
      { label: 'Custom users & datasets', included: true },
      { label: 'On-premise or private cloud', included: true },
      { label: 'SSO / SAML', included: true },
      { label: 'Advanced integrations', included: true },
      { label: 'Team collaboration', included: true },
      { label: 'Priority support', included: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const router = useRouter();
  const { initiateCheckout, getBillingPortal, loading: billingLoading, error: billingError, clearError } = useBilling();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<PlanKey | null>(null);
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  // Fetch authenticated user profile
  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setAuthLoading(false);
          return;
        }
        const res = await api.get<UserProfile>('/users/me');
        setProfile(res.data);
      } catch {
        setProfile(null);
      } finally {
        setAuthLoading(false);
      }
    };
    init();
  }, []);

  const isLoggedIn = !!profile;
  const currentPlan = (profile?.subscription_plan as string | undefined)?.toUpperCase() as PlanKey | undefined;

  const handleCta = async (plan: PlanConfig) => {
    // ON_PREMISE: handled via mailto link in the card — this branch should not fire
    if (plan.isOnPremise) return;

    if (!isLoggedIn) {
      router.push('/?redirect=pricing');
      return;
    }

    if (currentPlan === plan.key) return;

    setActivePlan(plan.key);
    clearError();

    try {
      if (!currentPlan || currentPlan === 'STARTER') {
        // No plan or on starter — open Stripe checkout
        const url = await initiateCheckout(plan.key, billing);
        window.location.href = url;
      } else {
        // Already on a paid plan — open billing portal to manage/upgrade
        const url = await getBillingPortal();
        window.location.href = url;
      }
    } finally {
      setActivePlan(null);
    }
  };

  return (
    <div
      className="min-h-screen py-16 px-4"
      style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
          No free plan — we earn your trust through our domain expertise.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span className={billing === 'monthly' ? 'font-semibold' : ''} style={{ color: billing === 'monthly' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Monthly
        </span>
        <button
          onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
          aria-label="Toggle annual billing"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 ${
            billing === 'annual' ? 'bg-brand-teal' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              billing === 'annual' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={billing === 'annual' ? 'font-semibold' : ''} style={{ color: billing === 'annual' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Annual{' '}
          <Badge variant="secondary" className="ml-1 text-xs">
            −17%
          </Badge>
        </span>
      </div>

      {/* Error banner */}
      {billingError && (
        <div className="mx-auto max-w-3xl mb-8">
          <div
            className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
            style={{
              background: 'var(--sl-red-light)',
              borderColor: 'var(--sl-red-muted)',
              color: 'var(--sl-red)',
            }}
          >
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{billingError}</span>
            <button onClick={clearError} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const isCurrent = isLoggedIn && currentPlan === plan.key;
          const isButtonLoading = billingLoading && activePlan === plan.key;

          // Price display
          const displayPrice = plan.isOnPremise
            ? plan.monthlyPrice
            : billing === 'annual'
              ? plan.annualPrice
              : plan.monthlyPrice;

          const displayPriceNote = plan.isOnPremise
            ? plan.priceNote
            : billing === 'annual'
              ? `/ year`
              : plan.priceNote;

          const displayEquiv = !plan.isOnPremise && billing === 'annual'
            ? plan.annualMonthlyEquiv
            : null;

          return (
            <div key={plan.key} className="relative flex flex-col">
              {plan.highlight && (
                <div className="flex justify-center mb-2">
                  <Badge variant="teal" className="text-xs font-semibold px-3 py-0.5">
                    Most popular
                  </Badge>
                </div>
              )}

              <Card
                className={`flex flex-col h-full ${
                  plan.highlight ? 'ring-2 ring-brand-teal shadow-lg' : ''
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    {isCurrent && (
                      <Badge variant="success" className="text-xs">
                        Current plan
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">{plan.description}</CardDescription>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="flex items-end gap-1">
                      <span className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {displayPrice}
                      </span>
                      <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                        {displayPriceNote}
                      </span>
                    </div>
                    {displayEquiv && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {displayEquiv}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {plan.engagement}
                    </p>
                  </div>
                </CardHeader>

                {/* Feature list */}
                <CardContent className="flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature.label} className="flex items-center gap-2.5 text-sm">
                        {feature.included ? (
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: 'var(--sl-teal-light)' }}
                          >
                            <Check className="h-3 w-3" style={{ color: 'var(--sl-teal-dark)' }} />
                          </span>
                        ) : (
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: 'var(--surface-secondary)' }}
                          >
                            <X className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                          </span>
                        )}
                        <span style={{ color: feature.included ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                {/* CTA */}
                <CardFooter className="pt-4">
                  {authLoading ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : plan.isOnPremise ? (
                    <a
                      href="mailto:contact@scilicium.com?subject=GenoLens Enterprise"
                      className="inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      Contact the team
                    </a>
                  ) : (
                    <Button
                      variant={plan.highlight ? 'teal' : isCurrent ? 'secondary' : 'outline'}
                      size="lg"
                      className="w-full"
                      disabled={isCurrent || (billingLoading && activePlan !== plan.key)}
                      onClick={() => handleCta(plan)}
                    >
                      {isButtonLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Redirecting…</span>
                        </>
                      ) : isCurrent ? (
                        'Current plan'
                      ) : (
                        plan.ctaLabel
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="mt-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Annual billing saves ~17% (2 months free). Enterprise pricing is on request. Prices exclude VAT.
      </p>
    </div>
  );
}
