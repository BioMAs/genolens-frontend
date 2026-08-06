import { canUseAI, hasUnlimitedAI, isPrivilegedRole, normalizePlan } from '@/utils/plan';

/**
 * Regression tests for the plan-vocabulary migration.
 *
 * Migration 2026_05_27_1000 renamed the subscription plans BASIC/PREMIUM/ADVANCED
 * to STARTER/TEAM/ON_PREMISE. The user-facing frontend was never migrated, which
 * produced two live defects:
 *
 *  - BillingSection collapsed any unrecognised plan to the lowest tier, so a TEAM
 *    user saw "Starter (Free)" on their own account page.
 *  - EnrichmentRadarPlot allow-listed ['PREMIUM','ADVANCED'], denying AI to TEAM
 *    users, while three other gates deny-listed 'BASIC' and therefore stopped
 *    blocking STARTER users at all.
 */

describe('normalizePlan', () => {
  it('passes live plan values through unchanged', () => {
    expect(normalizePlan('STARTER')).toBe('STARTER');
    expect(normalizePlan('TEAM')).toBe('TEAM');
    expect(normalizePlan('ON_PREMISE')).toBe('ON_PREMISE');
  });

  it('is case-insensitive', () => {
    expect(normalizePlan('team')).toBe('TEAM');
    expect(normalizePlan('On_Premise')).toBe('ON_PREMISE');
  });

  it('maps retired plan names onto their live equivalents', () => {
    expect(normalizePlan('BASIC')).toBe('STARTER');
    expect(normalizePlan('FREE')).toBe('STARTER');
    expect(normalizePlan('PREMIUM')).toBe('TEAM');
    expect(normalizePlan('ADVANCED')).toBe('ON_PREMISE');
  });

  it('falls back to STARTER for missing or unknown values', () => {
    expect(normalizePlan(undefined)).toBe('STARTER');
    expect(normalizePlan(null)).toBe('STARTER');
    expect(normalizePlan('')).toBe('STARTER');
    expect(normalizePlan('WHATEVER')).toBe('STARTER');
  });

  it('never returns a retired plan name', () => {
    for (const input of ['BASIC', 'FREE', 'PREMIUM', 'ADVANCED', 'nonsense']) {
      expect(['STARTER', 'TEAM', 'ON_PREMISE']).toContain(normalizePlan(input));
    }
  });
});

describe('isPrivilegedRole', () => {
  it('recognises both admin roles', () => {
    expect(isPrivilegedRole('ADMIN')).toBe(true);
    expect(isPrivilegedRole('SCILICIUM_ADMIN')).toBe(true);
    expect(isPrivilegedRole('scilicium_admin')).toBe(true);
  });

  it('rejects ordinary roles and missing values', () => {
    expect(isPrivilegedRole('USER')).toBe(false);
    expect(isPrivilegedRole('ANALYST')).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
  });
});

describe('canUseAI', () => {
  it('grants AI to TEAM — the defect that denied it', () => {
    expect(canUseAI({ subscription_plan: 'TEAM', role: 'USER' })).toBe(true);
  });

  it('grants AI to ON_PREMISE', () => {
    expect(canUseAI({ subscription_plan: 'ON_PREMISE', role: 'USER' })).toBe(true);
  });

  it('denies AI to STARTER — the defect that stopped blocking it', () => {
    expect(canUseAI({ subscription_plan: 'STARTER', role: 'USER' })).toBe(false);
  });

  it('grants AI to both admin roles regardless of plan', () => {
    expect(canUseAI({ subscription_plan: 'STARTER', role: 'ADMIN' })).toBe(true);
    expect(canUseAI({ subscription_plan: 'STARTER', role: 'SCILICIUM_ADMIN' })).toBe(true);
  });

  it('fails closed on a missing profile', () => {
    expect(canUseAI(null)).toBe(false);
    expect(canUseAI(undefined)).toBe(false);
  });

  it('fails closed on an unknown plan for a non-admin', () => {
    expect(canUseAI({ subscription_plan: 'MYSTERY', role: 'USER' })).toBe(false);
  });

  it('honours stale JWT metadata carrying retired names', () => {
    expect(canUseAI({ subscription_plan: 'PREMIUM', role: 'USER' })).toBe(true);
    expect(canUseAI({ subscription_plan: 'BASIC', role: 'USER' })).toBe(false);
  });
});

describe('hasUnlimitedAI', () => {
  it('matches the backend: TEAM, ON_PREMISE and admins have no cap', () => {
    expect(hasUnlimitedAI({ subscription_plan: 'TEAM', role: 'USER' })).toBe(true);
    expect(hasUnlimitedAI({ subscription_plan: 'ON_PREMISE', role: 'USER' })).toBe(true);
    expect(hasUnlimitedAI({ subscription_plan: 'STARTER', role: 'ADMIN' })).toBe(true);
    expect(hasUnlimitedAI({ subscription_plan: 'STARTER', role: 'USER' })).toBe(false);
  });
});
