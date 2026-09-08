'use client';

/**
 * Badge de crédits IA, rendu par la barre latérale et par la barre du haut.
 *
 * Il appelait `/users/me` lui-même, en `useEffect` sans cache — le troisième
 * lecteur non caché du même endpoint — et portait sa propre règle de calcul,
 * avec un quota gratuit de 15 codé en dur. Le calcul vit maintenant dans
 * `useQuotas`, reporté à l'identique : ce qui change est la source, pas le
 * chiffre.
 *
 * Il ne rend RIEN sans profil. L'implémentation d'origine vérifiait la session
 * Supabase avant d'appeler l'API ; sans cette garde, un 401 laisse un profil
 * vide, dont le calcul tire `max(0, 0 + 15) = 15` — le badge annoncerait
 * « 15 AI » à un utilisateur déconnecté, sur toutes les pages.
 */
import { Sparkles, AlertCircle } from 'lucide-react';

import { useQuotas } from '@/hooks/useQuotas';

/** En dessous de ce solde, on prévient. */
const LOW_CREDITS = 3;

export default function QuotaDisplay() {
  const { ai, isLoading, hasProfile } = useQuotas();

  if (isLoading) {
    return <div className="h-6 w-20 animate-pulse rounded-full" style={{ background: 'var(--border)' }} />;
  }

  if (!hasProfile) return null;

  if (ai.unlimited) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Unlimited</span>
      </div>
    );
  }

  const credits = ai.credits ?? 0;

  if (credits <= 0) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
        style={{
          background: 'var(--sl-red-light)',
          borderColor: 'var(--sl-red-muted)',
          color: 'var(--sl-red-dark)',
        }}
        title="Quota exceeded"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span>0 AI</span>
      </div>
    );
  }

  const isLow = credits <= LOW_CREDITS;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={
        isLow
          ? {
              background: 'color-mix(in srgb, var(--dc-amber) 12%, transparent)',
              borderColor: 'color-mix(in srgb, var(--dc-amber) 35%, transparent)',
              color: 'var(--dc-amber)',
            }
          : {
              background: 'var(--sl-teal-light)',
              borderColor: 'var(--sl-teal-muted)',
              color: 'var(--sl-teal-dark)',
            }
      }
      title={`${credits} AI interpretations available`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{credits} AI</span>
    </div>
  );
}
