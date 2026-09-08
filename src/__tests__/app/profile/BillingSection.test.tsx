/**
 * `BillingSection` ne parle plus que de facturation.
 *
 * Elle lisait trois champs que `/billing/subscription` ne renvoie pas —
 * `max_projects`, `ai_interpretations_used` et `status` — et affichait le
 * plafond de la grille tarifaire sans jamais montrer la consommation : la
 * ligne « Analyses / month » annonçait 30 quel que soit le nombre déjà
 * consommé. Les chiffres d'usage sont passés à `UsageSection`, qui lit
 * `useQuotas`.
 *
 * Ces tests verrouillent les deux moitiés : ce qui reste (plan, statut, date
 * de renouvellement, portail) et ce qui ne doit plus jamais réapparaître ici.
 */
import { render, screen, waitFor } from '@testing-library/react';

import BillingSection from '@/app/profile/BillingSection';

const getSubscription = jest.fn();
const getBillingPortal = jest.fn();

jest.mock('@/hooks/useBilling', () => ({
  useBilling: () => ({
    getSubscription,
    getBillingPortal,
    error: null,
    loading: false,
  }),
}));

jest.mock('@/hooks/usePricing', () => ({
  usePricing: () => ({
    data: {
      version: 'test',
      status: 'test',
      currency: 'EUR',
      tax_mode: 'HT',
      plans: [
        {
          id: 'STARTER',
          name_en: 'Starter',
          order: 1,
          price_monthly: 100,
          price_annual: 1020,
          max_projects: 15,
          contrast_quota: 30,
          quota_period: 'monthly',
          entitlements: { ai_interpretation: 'none' },
          marketing_features: [],
        },
      ],
      addons: [],
    },
  }),
}));

const SUBSCRIPTION = {
  plan: 'STARTER',
  is_active: true,
  stripe_customer_id: 'cus_1',
  subscription_starts_at: '2026-01-15T00:00:00Z',
  subscription_ends_at: '2027-01-15T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  getSubscription.mockResolvedValue(SUBSCRIPTION);
});

it('shows the plan and its active status', async () => {
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  expect(screen.getByText('Active')).toBeInTheDocument();
});

it('shows the renewal date served by the API', async () => {
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Renewal Date')).toBeInTheDocument());
  expect(screen.getByText(/2027/)).toBeInTheDocument();
});

it('offers the billing portal to a paid plan with a Stripe customer', async () => {
  render(<BillingSection />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument()
  );
});

it('offers an upgrade link when there is no Stripe customer to manage', async () => {
  getSubscription.mockResolvedValue({ ...SUBSCRIPTION, stripe_customer_id: null });
  render(<BillingSection />);
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /upgrade plan/i })).toBeInTheDocument()
  );
});

// ── ce qui ne doit plus apparaître ici ─────────────────────────────────────

it('no longer states a project cap, which UsageSection owns', async () => {
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  expect(screen.queryByText(/max projects/i)).not.toBeInTheDocument();
});

it('no longer states a comparison quota without its usage', async () => {
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  // Le libellé annonçait « Analyses / month → 30 », la valeur de la grille,
  // jamais la consommation.
  expect(screen.queryByText(/analyses \//i)).not.toBeInTheDocument();
});

it('no longer states AI interpretation usage', async () => {
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  expect(screen.queryByText(/ai interpretations/i)).not.toBeInTheDocument();
});

it('renders no status banner, a field the API never returns', async () => {
  // `status` était lu sur la charge utile de /billing/subscription, qui ne le
  // contient pas : les deux bandeaux étaient du code mort. Même en le forçant,
  // rien ne doit s'afficher.
  getSubscription.mockResolvedValue({ ...SUBSCRIPTION, status: 'cancelled' });
  render(<BillingSection />);
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  expect(screen.queryByText(/subscription expired/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/pending activation/i)).not.toBeInTheDocument();
});
