/**
 * Plan names and gate copy shown in the UI.
 *
 * The plans are Starter, Pro (internal id TEAM) and Enterprise (internal id
 * ON_PREMISE), per `name_en` in backend/app/config/pricing.json. Gate messages
 * used to name retired plans ("Pro or Advanced", "PREMIUM or ADVANCED") and a
 * price that never existed ("Starting at $29/month").
 */
import {
  PAID_PLANS_LABEL,
  PLAN_GATE_COPY,
  PLAN_LABELS,
  UPGRADE_HREF,
  planLabel,
} from '@/utils/plan';

describe('plan labels', () => {
  it('uses the names from the pricing grid', () => {
    expect(PLAN_LABELS).toEqual({ STARTER: 'Starter', TEAM: 'Pro', ON_PREMISE: 'Enterprise' });
  });

  it('labels legacy plan values with the plan they map to', () => {
    expect(planLabel('PREMIUM')).toBe('Pro');
    expect(planLabel('ADVANCED')).toBe('Enterprise');
    expect(planLabel(null)).toBe('Starter');
  });

  it('points upgrades to /pricing', () => {
    expect(UPGRADE_HREF).toBe('/pricing');
  });
});

describe('gate copy', () => {
  const messages = Object.values(PLAN_GATE_COPY);

  it('names both plans that carry the entitlement', () => {
    expect(PAID_PLANS_LABEL).toBe('Pro or Enterprise');
    for (const message of messages) {
      expect(message).toMatch(/Pro/);
      expect(message).toMatch(/Enterprise/);
    }
  });

  it('never names a retired plan or a hard-coded price', () => {
    for (const message of messages) {
      expect(message).not.toMatch(/Advanced|PREMIUM|ADVANCED|Team plan|\$\d/);
    }
  });

  it('mentions the Report customization add-on on the PDF gate', () => {
    expect(PLAN_GATE_COPY.pdfReport).toBe(
      'PDF reports require a Pro or Enterprise plan. Custom branding comes with the Report customization add-on.',
    );
  });
});
