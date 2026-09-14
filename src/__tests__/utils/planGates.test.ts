/**
 * The UI mirrors of the two plan entitlements that were declared in the grid and
 * enforced nowhere until now: `advanced_export` (PDF reports) and
 * `multi_comparison` (Venn, intersection enrichment).
 *
 * These are mirrors, not the gate. The backend decides — `User.can_export_advanced`
 * and `User.can_use_multi_comparison`, via `require_advanced_export` and
 * `require_team_plan`. What is pinned here is that the UI does not *contradict*
 * it: a TEAM user must never see a lock on something the API will happily serve,
 * and a STARTER must not be handed a button that can only 403.
 *
 * The legacy-plan cases matter more than they look. Plan values still reach the
 * UI from a stale JWT `user_metadata.subscription_tier`, which is not rewritten
 * when an admin changes the plan in the database — that is exactly how TEAM users
 * once got shown "Starter (Free)" on their own account page.
 */
import {
  canExportAdvanced,
  canUseMultiComparison,
  normalizePlan,
} from '@/utils/plan';

type Profile = { subscription_plan?: string | null; role?: string | null };

const starter: Profile = { subscription_plan: 'STARTER', role: 'USER' };
const team: Profile = { subscription_plan: 'TEAM', role: 'USER' };
const onPrem: Profile = { subscription_plan: 'ON_PREMISE', role: 'USER' };

describe.each([
  ['canExportAdvanced', canExportAdvanced],
  ['canUseMultiComparison', canUseMultiComparison],
])('%s', (_name, gate) => {
  it('allows TEAM and ON_PREMISE, refuses STARTER', () => {
    expect(gate(team)).toBe(true);
    expect(gate(onPrem)).toBe(true);
    expect(gate(starter)).toBe(false);
  });

  it.each(['ADMIN', 'SCILICIUM_ADMIN', 'admin'])(
    'lets role %s through regardless of plan',
    (role) => {
      expect(gate({ subscription_plan: 'STARTER', role })).toBe(true);
    },
  );

  it('fails closed on a missing profile', () => {
    // /users/me can 500, and the hook then yields undefined. Showing a lock is
    // recoverable; showing a button that can only 403 is not.
    expect(gate(undefined)).toBe(false);
    expect(gate(null)).toBe(false);
  });

  it('honours legacy plan values from a stale JWT', () => {
    // PREMIUM -> TEAM and ADVANCED -> ON_PREMISE, per normalizePlan. Collapsing
    // these to STARTER would lock paying users out of the UI for features the
    // backend grants them.
    expect(normalizePlan('PREMIUM')).toBe('TEAM');
    expect(normalizePlan('ADVANCED')).toBe('ON_PREMISE');
    expect(gate({ subscription_plan: 'PREMIUM', role: 'USER' })).toBe(true);
    expect(gate({ subscription_plan: 'ADVANCED', role: 'USER' })).toBe(true);
  });

  it('treats an unknown plan as the lowest tier', () => {
    expect(gate({ subscription_plan: 'WHATEVER', role: 'USER' })).toBe(false);
  });
});
