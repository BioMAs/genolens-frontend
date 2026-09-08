'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import { usePricing } from '@/hooks/usePricing';
import { annualDiscountPct, plansOrdered, type Plan } from '@/types/pricing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Plans, prices and card copy all come from GET /pricing — the single source
// of truth (backend/app/data/pricing.json). There is deliberately no local
// plan table here: this page used to carry one of four competing copies, and
// they had drifted apart (a paying Starter customer was labelled "Free" on the
// dashboard). Never reintroduce hard-coded prices or plan names.
// ---------------------------------------------------------------------------

type BillingCycle = 'monthly' | 'annual';

const SALES_EMAIL = 'contact@scilicium.com';

/** Enterprise-style plan: quoted per deal rather than listed. */
const isQuoted = (plan: Plan) => plan.price_monthly == null && plan.price_annual == null;

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { data: grid, isLoading: gridLoading, isError: gridError } = usePricing();
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Fetch authenticated user profile (for the current-plan badge + email)
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
  const currentPlan = (profile?.subscription_plan as string | undefined)?.toUpperCase();

  // Plan changes are handled as a request: notify the team by email, then confirm.
  const submitRequest = async (plan: Plan, details: string) => {
    setNotice(null);
    setSubmitting(plan.id);
    try {
      await api.post('/users/requests', { type: 'plan', item: plan.name_en, details });
      setNotice({ kind: 'success', text: "Request sent — we'll get back to you soon." });
    } catch {
      setNotice({ kind: 'error', text: `Couldn't send your request. Please email ${SALES_EMAIL}.` });
    } finally {
      setSubmitting(null);
    }
  };

  const requestPlan = (plan: Plan) => {
    const currency = grid?.currency ?? 'EUR';
    const annual = billing === 'annual';
    const amount = annual ? plan.price_annual : plan.price_monthly;
    const price = amount != null ? money(amount, currency) : (plan.pricing_display_en ?? 'On request');
    submitRequest(plan, `${price} ${annual ? '/ year' : '/ month'}, ${annual ? 'annual' : 'monthly'} billing`);
  };

  const contactSales = (plan: Plan) => submitRequest(plan, 'Enterprise enquiry — custom terms');

  // Remise annuelle affichée : dérivée de la grille, jamais écrite en dur.
  // Le calcul vit dans `types/pricing.ts` avec les autres lecteurs de grille,
  // pour être testable sans monter la page.
  const discountPct = annualDiscountPct(grid);

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight mb-3">Simple, transparent pricing</h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
          Pick a plan and we&apos;ll set it up for you — no credit card required to get in touch.
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
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2"
          style={{ background: billing === 'annual' ? 'var(--sl-teal)' : 'var(--border-strong)' }}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              billing === 'annual' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={billing === 'annual' ? 'font-semibold' : ''} style={{ color: billing === 'annual' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Annual{' '}
          {discountPct != null && (
            <Badge variant="secondary" className="ml-1 text-xs">
              up to −{discountPct}%
            </Badge>
          )}
        </span>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="mx-auto max-w-3xl mb-8">
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
            style={
              notice.kind === 'success'
                ? { background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)', color: 'var(--sl-teal)' }
                : { background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)', color: 'var(--sl-red-dark)' }
            }
          >
            {notice.kind === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Plan cards — rendered from the grid, never from a local table */}
      {gridLoading ? (
        <div className="mx-auto max-w-5xl flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : gridError || !grid ? (
        <div className="mx-auto max-w-3xl rounded-xl border px-4 py-3 text-sm text-center"
             style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }}>
          <span style={{ color: 'var(--text-primary)' }}>
            Couldn&apos;t load our plans just now. Please email{' '}
            <a href={`mailto:${SALES_EMAIL}`} className="underline">{SALES_EMAIL}</a> and we&apos;ll help.
          </span>
        </div>
      ) : (
      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {plansOrdered(grid).map((plan) => {
          const isCurrent = isLoggedIn && currentPlan === plan.id.toUpperCase();
          const isSubmitting = submitting === plan.id;
          const quoted = isQuoted(plan);
          const currency = grid.currency ?? 'EUR';

          const amount = billing === 'annual' ? plan.price_annual : plan.price_monthly;
          const displayPrice = amount != null
            ? money(amount, currency)
            : (plan.pricing_display_en ?? 'On request');
          const displayPriceNote = quoted ? '' : billing === 'annual' ? '/ year' : '/ month';
          // Monthly equivalent of the annual commitment, derived rather than stored:
          // one number to keep in step instead of two.
          const displayEquiv = !quoted && billing === 'annual' && plan.price_annual != null
            ? `≈ ${money(Math.round(plan.price_annual / 12), currency)} / month`
            : null;

          return (
            <div key={plan.id} className="relative flex flex-col">
              {plan.most_popular && (
                <div className="flex justify-center mb-2">
                  <Badge variant="teal" className="text-xs font-semibold px-3 py-0.5">Most popular</Badge>
                </div>
              )}

              <Card className={`flex flex-col h-full ${plan.most_popular ? 'ring-2 ring-brand-teal shadow-lg' : ''}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-xl">{plan.name_en}</CardTitle>
                    {isCurrent && <Badge variant="success" className="text-xs">Current plan</Badge>}
                  </div>
                  {plan.description_en && <CardDescription className="mt-1">{plan.description_en}</CardDescription>}

                  {/* Price */}
                  <div className="mt-4">
                    <div className="flex items-end gap-1">
                      <span className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{displayPrice}</span>
                      {displayPriceNote && <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{displayPriceNote}</span>}
                    </div>
                    {displayEquiv && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{displayEquiv}</p>}
                    {plan.engagement_en && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{plan.engagement_en}</p>}
                  </div>
                </CardHeader>

                {/* Feature list — commercial promises, not entitlements */}
                <CardContent className="flex-1">
                  <ul className="space-y-2.5">
                    {(plan.marketing_features ?? []).map((feature) => (
                      <li key={feature.label} className="flex items-center gap-2.5 text-sm">
                        {feature.included ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--sl-teal-light)' }}>
                            <Check className="h-3 w-3" style={{ color: 'var(--sl-teal-dark)' }} />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--surface-secondary)' }}>
                            <X className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                          </span>
                        )}
                        <span style={{ color: feature.included ? 'var(--text-primary)' : 'var(--text-muted)' }}>{feature.label}</span>
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
                  ) : quoted ? (
                    <Button variant="outline" size="lg" className="w-full" disabled={isSubmitting} onClick={() => contactSales(plan)}>
                      {isSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Sending…</span></>) : (plan.cta_label_en ?? 'Contact sales')}
                    </Button>
                  ) : (
                    <Button
                      variant={plan.most_popular ? 'teal' : isCurrent ? 'secondary' : 'outline'}
                      size="lg"
                      className="w-full"
                      disabled={isCurrent || isSubmitting}
                      onClick={() => requestPlan(plan)}
                    >
                      {isSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Sending…</span></>) : isCurrent ? 'Current plan' : (plan.cta_label_en ?? `Request ${plan.name_en}`)}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          );
        })}
      </div>
      )}

      {/* Footer note */}
      <p className="mt-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Plan changes are handled by our team — click a plan to send a prefilled request. {discountPct != null ? `Annual billing saves up to ${discountPct}%. ` : ''}Enterprise pricing is on request. Prices exclude VAT.
      </p>
    </div>
  );
}
