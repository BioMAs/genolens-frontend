'use client';

/**
 * Usage et quotas sur la page de compte.
 *
 * Ces chiffres vivaient dans `BillingSection`, qui affichait le plafond de la
 * grille tarifaire sans jamais montrer la consommation : la ligne « Analyses /
 * month » annonçait 30 quel que soit le nombre déjà consommé — un libellé
 * juste, du reste : l'unité facturable EST l'analyse. Ils viennent
 * désormais de `useQuotas`, comme sur le dashboard, via le même composant —
 * une seule autorité, un seul rendu, aucune chance de divergence entre les
 * deux surfaces.
 *
 * `BillingSection` ne garde que ce qui relève de la facturation : plan,
 * statut, date de renouvellement, portail.
 */
import { Gauge } from 'lucide-react';

import QuotaMeters from '@/components/QuotaMeters';

export default function UsageSection() {
  return (
    <section>
      <h2
        className="mb-1 flex items-center gap-2 font-display text-[15px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        <Gauge className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} /> Usage &amp; quotas
      </h2>
      <p className="mb-3 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
        What is left on your plan this month. One analysis counts as one, whatever its
        number of contrasts. Quotas reset on the first of each month.
      </p>
      <QuotaMeters layout="column" />
    </section>
  );
}
