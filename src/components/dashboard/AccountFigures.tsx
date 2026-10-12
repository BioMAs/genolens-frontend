'use client';

import type { AggregatedStats } from '@/hooks/useUserDashboardStats';
import { useCountUp } from '@/hooks/useMotion';

/**
 * Les chiffres du compte, en une bande reglee plutot qu'en pastilles.
 *
 * Cinq totaux REELS, lus de gauche a droite dans l'ordre du pipeline : on
 * cree un projet, on y depose des datasets, on en tire des comparaisons, qui
 * donnent des genes differentiels, qui donnent des voies enrichies. La bande
 * se lit donc comme un entonnoir, pas comme cinq indicateurs juxtaposes.
 *
 * Pas de cartes : des filets. Cinq cartes identiques cote a cote sont le
 * gabarit « hero metrics » qu'on voit partout ; une regle haute et basse
 * suffit a grouper, et laisse le chiffre porter la hierarchie.
 *
 * Le nombre anime est `aria-hidden` ; la valeur finale est lue dans un
 * `sr-only`, pour qu'un lecteur d'ecran n'entende jamais un compteur a 0.
 */

interface Figure {
  label: string;
  value: number;
}

function FigureCell({ label, value, index, loading }: Figure & { index: number; loading: boolean }) {
  const shown = useCountUp(loading ? 0 : value, { duration: 1100, delay: 120 + index * 90 });
  return (
    <div className="min-w-0 py-4 sm:px-6 sm:first:pl-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 text-heading tabular-nums text-primary">
        {loading ? (
          <span className="skeleton inline-block h-6 w-14 align-middle" aria-hidden />
        ) : (
          <>
            <span aria-hidden>{shown.toLocaleString('en-US')}</span>
            <span className="sr-only">{value.toLocaleString('en-US')}</span>
          </>
        )}
      </dd>
    </div>
  );
}

export default function AccountFigures({
  stats,
  loading = false,
}: {
  stats?: AggregatedStats;
  loading?: boolean;
}) {
  const figures: Figure[] = [
    { label: 'Projects', value: stats?.total_projects ?? 0 },
    { label: 'Datasets', value: stats?.total_datasets ?? 0 },
    { label: 'Comparisons', value: stats?.total_comparisons ?? 0 },
    { label: 'DE genes', value: stats?.total_deg_genes ?? 0 },
    { label: 'Enriched pathways', value: stats?.total_enrichment_pathways ?? 0 },
  ];

  return (
    <dl
      data-tour="dashboard-kpis"
      aria-label="Account totals"
      className="grid grid-cols-2 border-y border-default sm:grid-cols-5 sm:divide-x sm:divide-[var(--border)]"
    >
      {figures.map((f, i) => (
        <FigureCell key={f.label} {...f} index={i} loading={loading} />
      ))}
    </dl>
  );
}
