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

type PlanKey = 'BASIC' | 'PREMIUM' | 'ADVANCED';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface PlanConfig {
  key: PlanKey;
  displayName: string;
  price: string;
  priceNote: string;
  description: string;
  features: PlanFeature[];
  ctaLabel: string;
  highlight: boolean;
}

const PLANS: PlanConfig[] = [
  {
    key: 'BASIC',
    displayName: 'Starter',
    price: 'Free',
    priceNote: 'forever',
    description: 'Get started with essential genomics analysis tools.',
    highlight: false,
    ctaLabel: 'Get Started',
    features: [
      { label: '3 projects', included: true },
      { label: '500 MB storage', included: true },
      { label: '1 seat', included: true },
      { label: 'Community support', included: true },
      { label: 'AI interpretations', included: false },
    ],
  },
  {
    key: 'PREMIUM',
    displayName: 'Pro',
    price: '€49',
    priceNote: '/month',
    description: 'For researchers who need more power and AI-assisted insights.',
    highlight: true,
    ctaLabel: 'Upgrade to Pro',
    features: [
      { label: '20 projects', included: true },
      { label: '10 GB storage', included: true },
      { label: '1 seat', included: true },
      { label: 'Email support', included: true },
      { label: '50 AI interpretations/month', included: true },
    ],
  },
  {
    key: 'ADVANCED',
    displayName: 'Advanced',
    price: '€99',
    priceNote: '/month',
    description: 'For teams running large-scale multi-omics workflows.',
    highlight: false,
    ctaLabel: 'Upgrade to Advanced',
    features: [
      { label: 'Unlimited projects', included: true },
      { label: '50 GB storage', included: true },
      { label: '5 seats', included: true },
      { label: 'Priority support', included: true },
      { label: '200 AI interpretations/month', included: true },
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
  // Track which plan button is currently loading so we can show spinner per-card
  const [activePlan, setActivePlan] = useState<PlanKey | null>(null);

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
        // If profile fetch fails we treat the user as unauthenticated for this page
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
    // Not logged in — redirect to login with return hint
    if (!isLoggedIn) {
      if (plan.key === 'BASIC') {
        router.push('/');
      } else {
        router.push('/?redirect=pricing');
      }
      return;
    }

    // Already on this plan — no-op (button is disabled)
    if (currentPlan === plan.key) return;

    setActivePlan(plan.key);
    clearError();

    if (currentPlan === 'BASIC') {
      // User is on free plan — open Stripe checkout
      const url = await initiateCheckout(plan.key);
      window.location.href = url;
    } else {
      // User already has a paid plan — open billing portal to manage/upgrade
      const url = await getBillingPortal();
      window.location.href = url;
    }

    setActivePlan(null);
  };

  return (
    <div
      className="min-h-screen py-16 px-4"
      style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-3xl text-center mb-14">
        <h1 className="font-display text-4xl font-bold tracking-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
          Start free, upgrade when you need more
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error banner */}
      {/* ------------------------------------------------------------------ */}
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
            <button
              onClick={clearError}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Plan cards */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const isCurrent = isLoggedIn && currentPlan === plan.key;
          const isButtonLoading = billingLoading && activePlan === plan.key;

          return (
            <div key={plan.key} className="relative flex flex-col">
              {/* "Most popular" ribbon — only on Pro */}
              {plan.highlight && (
                <div className="flex justify-center mb-2">
                  <Badge variant="teal" className="text-xs font-semibold px-3 py-0.5">
                    Most popular
                  </Badge>
                </div>
              )}

              <Card
                className={`flex flex-col h-full ${
                  plan.highlight
                    ? 'ring-2 ring-brand-teal shadow-lg'
                    : ''
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    {isCurrent && (
                      <Badge variant="success" className="text-xs">
                        Your current plan
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">{plan.description}</CardDescription>

                  {/* Price */}
                  <div className="mt-4 flex items-end gap-1">
                    <span className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {plan.price}
                    </span>
                    <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {plan.priceNote}
                    </span>
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

      {/* ------------------------------------------------------------------ */}
      {/* Footer note */}
      {/* ------------------------------------------------------------------ */}
      <p className="mt-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        All plans include a 14-day free trial of paid features. Cancel anytime. Prices exclude VAT.
      </p>
    </div>
  );
}
