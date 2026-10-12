/**
 * `legacy_skin_claim` — keeps the former Skin claims module (claim scores, Skin Stack)
 * reachable under CosmOmics while the Pathway Nova is being validated.
 *
 * Off by default. Turn it on with `NEXT_PUBLIC_LEGACY_SKIN_CLAIM=true` at build time; the
 * legacy section then renders below the nova, for users who have the Skin claims add-on.
 * Delete this flag together with the legacy code once the nova is validated.
 */
export const LEGACY_SKIN_CLAIM = process.env.NEXT_PUBLIC_LEGACY_SKIN_CLAIM === 'true';
