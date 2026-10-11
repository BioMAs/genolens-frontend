'use client';

/**
 * Badge de crédits IA, rendu par la barre latérale et par la barre du haut.
 *
 * Il appelait `/users/me` lui-même, en `useEffect` sans cache — le troisième
 * lecteur non caché du même endpoint — et portait sa propre règle de calcul,
 * avec un quota gratuit de 15 codé en dur. Le calcul vit maintenant dans
 * `useQuotas`, et ce quota gratuit — que le backend n'a jamais appliqué — en a
 * disparu : sans plafond ni IA par le plan, le solde est 0.
 *
 * Il ne rend RIEN sans profil. L'implémentation d'origine vérifiait la session
 * Supabase avant d'appeler l'API ; sans cette garde, un 401 laissait un profil
 * vide, dont l'ancien calcul tirait `max(0, 0 + 15) = 15` — le badge annonçait
 * « 15 AI » à un utilisateur déconnecté, sur toutes les pages. Il annoncerait
 * aujourd'hui « 0 AI » en rouge : pas plus vrai.
 */
import { Sparkles, AlertCircle } from 'lucide-react';

import { quotaTone, useQuotas } from '@/hooks/useQuotas';
import { AI_QUOTA_COPY, PLAN_GATE_COPY } from '@/utils/plan';

export default function QuotaDisplay() {
  const { ai, isLoading, hasProfile } = useQuotas();

  if (isLoading) {
    return <div className="h-6 w-20 animate-pulse rounded-pill" style={{ background: 'var(--border)' }} />;
  }

  if (!hasProfile) return null;

  if (ai.unlimited) {
    // Etait un degrade from-purple-500/to-indigo-500 pris a la palette Tailwind
    // brute — hors systeme, et le dernier degrade de l'application
    // authentifiee. Un aplat d'accent suffit.
    return (
      <div className="flex items-center gap-2 rounded-pill bg-accent px-3 py-1 text-caption font-semibold text-on-accent">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Unlimited</span>
      </div>
    );
  }

  const credits = ai.credits ?? 0;
  // Plafond de requêtes IA (compte démo) : le badge montre le reste ET le
  // plafond, et son ton suit la même règle que les jauges de quotas.
  const capped = ai.max !== undefined;
  const label = capped ? `${credits}/${ai.max} AI` : `${credits} AI`;

  if (credits <= 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-pill border px-3 py-1 text-caption font-medium"
        style={{
          background: 'var(--sl-red-light)',
          borderColor: 'var(--sl-red-muted)',
          color: 'var(--sl-red-dark)',
        }}
        // Sans plafond, zéro veut dire « pas d'IA sur ce plan », pas un quota
        // dépassé : il n'y a jamais rien eu à dépasser.
        title={capped ? AI_QUOTA_COPY.title : PLAN_GATE_COPY.ai}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
    );
  }

  // Un solde positif n'existe que sous plafond (sans plafond : illimité ou 0),
  // donc le ton se lit sur le plafond, comme les jauges de quotas.
  const isLow = quotaTone(credits, ai.max ?? null) === 'low';

  return (
    <div
      className="flex items-center gap-2 rounded-pill border px-3 py-1 text-caption font-medium transition-colors"
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
      title={
        capped
          ? `${credits} of ${ai.max} AI requests left`
          : `${credits} AI interpretations available`
      }
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}
