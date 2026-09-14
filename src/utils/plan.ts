/**
 * Subscription plan helpers.
 *
 * Single source of truth for plan-based gating in the UI. Before this module the
 * same question was answered in three places with three different rules — two
 * denylists on the retired value `BASIC` and one allowlist on the retired
 * `PREMIUM`/`ADVANCED` — so after migration 2026_05_27_1000 renamed the plans,
 * TEAM users were denied AI in the UI while STARTER users were no longer blocked.
 *
 * Keep these rules mirroring the backend, which is authoritative:
 * `User.can_use_ai` in backend/app/models/models.py.
 */

/** Live plan values, matching the backend `SubscriptionPlan` enum. */
export type PlanKey = 'STARTER' | 'TEAM' | 'ON_PREMISE';

/** Roles that bypass plan gating, matching `UserRole` on the backend. */
const PRIVILEGED_ROLES = ['ADMIN', 'SCILICIUM_ADMIN'];

type PlanBearer = { subscription_plan?: string | null; role?: string | null } | null | undefined;

/**
 * Normalize any plan string to a live plan value.
 *
 * Legacy values (BASIC/FREE/PREMIUM/ADVANCED) can still reach the UI from stale
 * JWT `user_metadata.subscription_tier`, which is not rewritten when an admin
 * changes the plan in the database. Map them instead of collapsing everything
 * unknown to the lowest tier, which is how a TEAM user came to be shown as
 * "Starter (Free)" on their own account page.
 */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const upper = (plan ?? '').toUpperCase();
  if (upper === 'STARTER' || upper === 'TEAM' || upper === 'ON_PREMISE') return upper;
  if (upper === 'PREMIUM') return 'TEAM';
  if (upper === 'ADVANCED') return 'ON_PREMISE';
  return 'STARTER';
}

/** True when the user has an admin role that bypasses plan gating. */
export function isPrivilegedRole(role: string | null | undefined): boolean {
  return PRIVILEGED_ROLES.includes((role ?? '').toUpperCase());
}

/**
 * Mirrors `User.can_use_ai`: TEAM and ON_PREMISE have AI access, STARTER does
 * not, and admin roles always do. Fails closed on a missing profile.
 */
export function canUseAI(profile: PlanBearer): boolean {
  if (!profile) return false;
  if (isPrivilegedRole(profile.role)) return true;
  const plan = normalizePlan(profile.subscription_plan);
  return plan === 'TEAM' || plan === 'ON_PREMISE';
}

/**
 * Mirrors `User.ai_interpretations_remaining` returning None: TEAM, ON_PREMISE
 * and admin roles have no AI interpretation cap.
 */
export function hasUnlimitedAI(profile: PlanBearer): boolean {
  return canUseAI(profile);
}

/**
 * Mirrors `User.can_export_advanced`: PDF report generation is TEAM/ON_PREMISE
 * only, admin roles always. Backs the grid's `advanced_export` entitlement.
 *
 * Scope is PDF. CSV/TSV export is included in every plan, and no Excel export
 * exists in the product — so this must not be used to hide a CSV download.
 *
 * Kept as its own function rather than an alias of `canUseAI`: the two answer
 * different questions and the grid is free to move one without the other.
 */
export function canExportAdvanced(profile: PlanBearer): boolean {
  if (!profile) return false;
  if (isPrivilegedRole(profile.role)) return true;
  const plan = normalizePlan(profile.subscription_plan);
  return plan === 'TEAM' || plan === 'ON_PREMISE';
}

/**
 * Mirrors `User.can_use_multi_comparison`: comparing contrasts against each
 * other (Venn, intersection enrichment) is TEAM/ON_PREMISE only.
 *
 * NOT the `/comparisons` listing, which is a primary navigation destination open
 * to every plan, and NOT the contrast scatter, which belongs to the `scientific`
 * add-on rather than to a plan.
 */
export function canUseMultiComparison(profile: PlanBearer): boolean {
  if (!profile) return false;
  if (isPrivilegedRole(profile.role)) return true;
  const plan = normalizePlan(profile.subscription_plan);
  return plan === 'TEAM' || plan === 'ON_PREMISE';
}
