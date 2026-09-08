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

/**
 * Nombre de comparaisons déclarées par un fichier de contrastes.
 *
 * Pendant exact de `_declared_comparisons` côté backend
 * (`app/api/endpoints/analyses.py`) : la clé est `rows`, écrite à l'ingestion
 * par `DataProcessor.get_file_metadata`, avec `total_rows` en second choix.
 * Lire la même clé que la règle qui refuse est ce qui évite d'annoncer un
 * lancement possible que le backend rejettera.
 *
 * `null` quand la métadonnée est absente : dataset encore en traitement.
 */
export function declaredComparisons(
  metadata: Record<string, unknown> | undefined
): number | null {
  if (!metadata) return null;
  for (const key of ['rows', 'total_rows']) {
    const value = metadata[key];
    // `typeof true` vaut 'boolean' en TypeScript, mais la garde reste
    // explicite : le pendant Python existe parce qu'un booléen y passe pour
    // un entier.
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return null;
}

interface ComparisonQuotaNoticeProps {
  /** Comparaisons que le lancement va consommer, si on les connaît. */
  declared?: number | null;
}

export default function ComparisonQuotaNotice({ declared }: ComparisonQuotaNoticeProps = {}) {
  const { comparisons, resetsOn, tone, isLoading, hasProfile } = useQuotas();

  // Rien à dire tant que le profil est inconnu, et rien à dire sur un plan
  // sans plafond.
  if (isLoading || !hasProfile || comparisons.unlimited) return null;

  const remaining = comparisons.remaining ?? 0;
  const exhausted = remaining <= 0;
  // Le backend refuse un lancement dont le fichier declare plus de lignes que
  // le reste : le dire ici, plutot que de laisser l'utilisateur le decouvrir.
  const short = declared != null && declared > remaining;
  const warn = exhausted || short || tone !== 'ok';

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
        ) : short ? (
          <>
            This run <b>needs {declared}</b> comparisons but only <b>{remaining}</b> of{' '}
            {comparisons.max} {remaining === 1 ? 'is' : 'are'} left this month — resets{' '}
            {resetLabel}.
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
 * Vrai quand le lancement ne peut pas passer le quota du mois.
 *
 * `declared` est le nombre de comparaisons que le fichier de contrastes
 * annonce. Sans lui, la garde ne bloquait qu'à zéro restant, alors que le
 * backend refuse dès que ce nombre dépasse le reste : un utilisateur à 2
 * restantes lançant un fichier de 5 contrastes voyait le bouton actif et
 * découvrait le refus après coup — exactement ce que ce rappel doit éviter.
 *
 * Échoue OUVERT sur toute incertitude — profil en vol, profil jamais arrivé,
 * nombre déclaré inconnu (dataset encore en traitement) : bloquer par défaut
 * empêcherait un lancement légitime, alors que le backend refuse de toute
 * façon au-delà du quota (il réserve même la demande en vol au lancement).
 */
export function useComparisonQuotaBlocked(declared?: number | null): boolean {
  const { comparisons, isLoading, hasProfile } = useQuotas();

  if (isLoading || !hasProfile || comparisons.unlimited) return false;

  const remaining = comparisons.remaining ?? 0;
  if (remaining <= 0) return true;
  return declared != null && declared > remaining;
}
