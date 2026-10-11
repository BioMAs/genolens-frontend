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

import { SUPPORT_EMAIL } from '@/lib/contact';

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

/**
 * Display names for the live plans, matching `name_en` in
 * backend/app/config/pricing.json. The internal ids are not the names users see:
 * TEAM is sold as "Pro" and ON_PREMISE as "Enterprise".
 */
export const PLAN_LABELS: Record<PlanKey, string> = {
  STARTER: 'Starter',
  TEAM: 'Pro',
  ON_PREMISE: 'Enterprise',
};

/** Display name for any plan value, legacy ones included. */
export function planLabel(plan: string | null | undefined): string {
  return PLAN_LABELS[normalizePlan(plan)];
}

/** Where every upgrade call to action points. */
export const UPGRADE_HREF = '/pricing';

/**
 * The plans that unlock the TEAM/ON_PREMISE entitlements (AI interpretation,
 * PDF reports, multi-comparison), in the form the gate messages use.
 */
export const PAID_PLANS_LABEL = `${PLAN_LABELS.TEAM} or ${PLAN_LABELS.ON_PREMISE}`;

/** Gate copy, shared so every surface names the plans the same way. */
export const PLAN_GATE_COPY = {
  ai: `AI interpretation requires a ${PAID_PLANS_LABEL} plan.`,
  aiAvailableWith: `Available with the ${PLAN_LABELS.TEAM} and ${PLAN_LABELS.ON_PREMISE} plans`,
  /**
   * The Report customization add-on only brands the PDF (logo, colours, default
   * text); it does not unlock generation, which stays on the plan
   * (`advanced_export`). The tooltip names both so the add-on is not mistaken
   * for the way in.
   */
  pdfReport:
    `PDF reports require a ${PAID_PLANS_LABEL} plan. ` +
    'Custom branding comes with the Report customization add-on.',
  multiComparison: `Multi-comparison requires a ${PAID_PLANS_LABEL} plan`,
} as const;

/**
 * Copy for an account that has used up its AI request cap (demo accounts).
 *
 * Kept apart from `PLAN_GATE_COPY` on purpose: that one sends to an upgrade,
 * while a demo account already has the plan — what ran out is the demo's own
 * allowance, and only we can extend it.
 */
export const AI_QUOTA_COPY = {
  title: 'AI request limit reached',
  body:
    'This demo account has used all of its AI requests. ' +
    `Contact ${SUPPORT_EMAIL} to extend it.`,
} as const;

/**
 * Body of the 429 every AI endpoint returns once a capped account has no AI
 * request left (`reserve_ai_request`, backend/app/api/deps/subscription.py).
 * A structured `detail`, like `account_inactive`, so the UI branches on
 * `detail.error` rather than on a status code shared with other limits.
 */
export interface AiQuotaExhaustedDetail {
  error: 'ai_quota_exhausted';
  limit?: number;
  used?: number;
  message?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/**
 * Status and `detail` of an API error, from either shape the app produces: an
 * axios error (`response.status`, `response.data.detail`) or the plain
 * `{ status, detail }` a fetch-based caller builds from a non-OK response.
 */
function readError(err: unknown): { status?: unknown; detail?: unknown } {
  if (!isRecord(err)) return {};
  if (isRecord(err.response)) {
    const data = err.response.data;
    return { status: err.response.status, detail: isRecord(data) ? data.detail : undefined };
  }
  return { status: err.status, detail: err.detail };
}

/** The quota detail when `err` is the AI-cap 429, `null` otherwise. */
function aiQuotaDetail(err: unknown): AiQuotaExhaustedDetail | null {
  const { status, detail } = readError(err);
  if (status !== 429 || !isRecord(detail) || detail.error !== 'ai_quota_exhausted') return null;
  return detail as unknown as AiQuotaExhaustedDetail;
}

/** True when `err` is the 429 an AI endpoint returns once the AI cap is used up. */
export function isAiQuotaExhausted(err: unknown): boolean {
  return aiQuotaDetail(err) !== null;
}

/**
 * Message to show for an AI-cap 429: the backend's own wording when it sent
 * one, our copy otherwise.
 */
export function aiQuotaMessage(err: unknown): string {
  const message = aiQuotaDetail(err)?.message;
  return typeof message === 'string' && message.trim() ? message : AI_QUOTA_COPY.body;
}

/**
 * Readable message of an API error, whether `detail` is a string (most
 * endpoints) or a structured object carrying a `message` (the AI-cap and
 * account-state errors). Rendering the object as-is would print
 * "[object Object]".
 */
export function apiErrorMessage(err: unknown): string | undefined {
  const { detail } = readError(err);
  if (typeof detail === 'string') return detail || undefined;
  if (isRecord(detail) && typeof detail.message === 'string') return detail.message || undefined;
  return undefined;
}
