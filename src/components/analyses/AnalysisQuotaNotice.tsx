'use client';

/**
 * Rappel de quota juste avant le lancement d'une analyse.
 *
 * C'est là que le quota se dépense, et c'était le seul écran qui n'en disait
 * rien : l'utilisateur lançait, puis découvrait le refus du backend.
 *
 * **Une analyse coûte une unité**, quel que soit le nombre de contrastes de
 * son fichier — c'est l'unité que déclare la grille tarifaire
 * (`billable_unit`). Une version précédente de ce rappel comparait le nombre
 * de contrastes déclarés au reste du mois et bloquait le lancement au-delà :
 * elle répliquait une garde backend qui, elle-même, comptait la mauvaise
 * unité. Les deux sont corrigées.
 *
 * Le rappel ne s'affiche que quand il y a quelque chose à rappeler — un
 * bandeau « ∞ analyses restantes » serait du bruit sur le seul écran où l'on
 * veut avancer.
 */
import Link from 'next/link';
import { GitCompare, AlertCircle } from 'lucide-react';

import { useQuotas } from '@/hooks/useQuotas';

export default function AnalysisQuotaNotice() {
  const { analyses, resetsOn, tone, isLoading, hasProfile } = useQuotas();

  // Rien à dire tant que le profil est inconnu, et rien à dire sur un plan
  // sans plafond.
  if (isLoading || !hasProfile || analyses.unlimited) return null;

  const remaining = analyses.remaining ?? 0;
  const exhausted = remaining <= 0;
  const warn = exhausted || tone !== 'ok';

  const resetLabel = resetsOn.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' });

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{
        background: warn
          ? 'color-mix(in srgb, var(--dc-amber) 10%, var(--surface-raised))'
          : 'var(--surface-raised)',
        borderColor: warn
          ? 'color-mix(in srgb, var(--dc-amber) 35%, transparent)'
          : 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {exhausted ? (
        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--sl-red)' }} aria-hidden />
      ) : (
        <GitCompare
          className="h-4 w-4 shrink-0"
          style={{ color: warn ? 'var(--dc-amber)' : 'var(--sl-teal)' }}
          aria-hidden
        />
      )}

      <span className="min-w-0 flex-1">
        {exhausted ? (
          <>
            <b>No analysis left</b> this month. Your quota resets {resetLabel}.
          </>
        ) : (
          <>
            <b>{remaining}</b> of {analyses.max}{' '}
            {remaining === 1 ? 'analysis left' : 'analyses left'} this month — resets{' '}
            {resetLabel}. This run counts as one, whatever its number of contrasts.
          </>
        )}
      </span>

      {warn && (
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-semibold hover:underline"
          style={{ color: 'var(--sl-purple)' }}
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}

/**
 * Vrai quand il ne reste plus une seule analyse ce mois-ci.
 *
 * Une analyse coûte une unité : il suffit donc qu'il en reste une, quel que
 * soit le nombre de contrastes du fichier. Une version précédente comparait ce
 * nombre au reste et bloquait au-delà — elle répliquait une garde backend qui
 * comptait la mauvaise unité.
 *
 * Échoue OUVERT sur toute incertitude, profil en vol comme profil jamais
 * arrivé : bloquer par défaut empêcherait un lancement légitime, alors que le
 * backend refuse de toute façon à l'épuisement (il réserve même les analyses
 * en vol au lancement).
 */
export function useAnalysisQuotaBlocked(): boolean {
  const { analyses, isLoading, hasProfile } = useQuotas();

  if (isLoading || !hasProfile || analyses.unlimited) return false;
  return (analyses.remaining ?? 0) <= 0;
}
