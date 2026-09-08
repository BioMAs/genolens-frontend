'use client';

/**
 * Rappel de quota juste avant le lancement d'une analyse.
 *
 * C'est là que le quota de comparaisons se dépense, et c'était le seul écran
 * qui n'en disait rien : l'utilisateur lançait, puis découvrait le refus du
 * backend. Le rappel ne s'affiche que quand il y a quelque chose à rappeler —
 * un bandeau « ∞ comparaisons restantes » serait du bruit sur le seul écran où
 * l'on veut avancer.
 */
import Link from 'next/link';
import { GitCompare, AlertCircle } from 'lucide-react';

import { useQuotas } from '@/hooks/useQuotas';

export default function ComparisonQuotaNotice() {
  const { comparisons, resetsOn, tone, isLoading, hasProfile } = useQuotas();

  // Rien à dire tant que le profil est inconnu, et rien à dire sur un plan
  // sans plafond.
  if (isLoading || !hasProfile || comparisons.unlimited) return null;

  const remaining = comparisons.remaining ?? 0;
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
            <b>No comparison left</b> this month. Your quota resets {resetLabel}.
          </>
        ) : (
          <>
            <b>{remaining}</b> of {comparisons.max}{' '}
            {remaining === 1 ? 'comparison left' : 'comparisons left'} this month — resets{' '}
            {resetLabel}.
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
 * Vrai quand plus aucune comparaison n'est disponible ce mois-ci.
 *
 * Échoue OUVERT tant que le profil est inconnu — chargement comme erreur :
 * bloquer par défaut empêcherait un lancement légitime chaque fois que la
 * requête est lente, alors que le backend refuse de toute façon au-delà du
 * quota (il réserve même la demande en vol au lancement).
 */
export function useComparisonQuotaBlocked(): boolean {
  const { comparisons, isLoading, hasProfile } = useQuotas();

  if (isLoading || !hasProfile || comparisons.unlimited) return false;
  return (comparisons.remaining ?? 0) <= 0;
}
