'use client';

/**
 * Rangée de quotas : la réponse à « qu'est-ce qu'il me reste ».
 *
 * Elle met en avant le nombre **restant**, pas le nombre consommé. L'ancienne
 * carte de plan répondait en « utilisé / quota » sous le libellé « Analyses /
 * month », ce qui obligeait le lecteur à faire la soustraction pour obtenir la
 * seule information qu'il cherchait.
 *
 * Le composant ne prend aucune prop de données : il lit `useQuotas`, seule
 * autorité sur les quotas. Aucune règle ne doit être recalculée ici.
 */
import Link from 'next/link';
import { Sparkles, FolderOpen, GitCompare } from 'lucide-react';

import { useQuotas, type QuotaTone } from '@/hooks/useQuotas';
import { Meter } from '@/components/ui/meter';

const PLACEHOLDER = '—';

const METER_TONE: Record<QuotaTone, 'teal' | 'purple' | 'red'> = {
  ok: 'teal',
  low: 'purple',
  exhausted: 'red',
};

const VALUE_COLOR: Record<QuotaTone, string> = {
  ok: 'var(--text-primary)',
  low: 'var(--dc-amber)',
  exhausted: 'var(--sl-red)',
};

interface QuotaMetersProps {
  layout?: 'row' | 'column';
}

function Cell({
  testId,
  icon,
  label,
  children,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="gl-card min-w-0 flex-1 p-4"
    >
      <span
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

export default function QuotaMeters({ layout = 'row' }: QuotaMetersProps) {
  const quotas = useQuotas();

  // Tant que le profil n'est pas là — chargement comme erreur — on n'affiche
  // aucun chiffre. Un profil absent donnerait un quota à zéro, donc du rouge,
  // un « no comparison left » et un CTA « Upgrade » à un utilisateur qui n'a
  // rien épuisé ; et pour l'IA, le seul quota gratuit de 15.
  const known = quotas.hasProfile && !quotas.isLoading;
  const tone: QuotaTone = known ? quotas.tone : 'ok';

  const { comparisons, projects, ai } = quotas;
  const resetLabel = quotas.resetsOn.toLocaleDateString('en-GB', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      data-layout={layout}
      className={
        layout === 'row'
          ? 'flex flex-col gap-3 sm:flex-row'
          : 'flex flex-col gap-3'
      }
    >
      <Cell
        testId="quota-comparisons"
        icon={<GitCompare className="h-3.5 w-3.5" aria-hidden />}
        label="Comparisons"
      >
        {!known ? (
          <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--text-muted)' }}>
            {PLACEHOLDER}
          </p>
        ) : comparisons.unlimited ? (
          <>
            <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--sl-teal)' }}>
              ∞
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Unlimited comparisons
            </p>
          </>
        ) : (
          <>
            <p
              className="mt-1 font-display text-2xl font-semibold tabular-nums"
              style={{ color: VALUE_COLOR[tone] }}
            >
              {comparisons.remaining}{' '}
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                of {comparisons.max}
              </span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {comparisons.remaining === 0
                ? 'No comparison left this month'
                : 'comparisons left this month'}
            </p>
            <div className="mt-2">
              <Meter
                value={comparisons.max ? comparisons.used / comparisons.max : 0}
                tone={METER_TONE[tone]}
                height={8}
              />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Resets {resetLabel}
            </p>
          </>
        )}
      </Cell>

      <Cell
        testId="quota-projects"
        icon={<FolderOpen className="h-3.5 w-3.5" aria-hidden />}
        label="Projects"
      >
        {!known ? (
          <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--text-muted)' }}>
            {PLACEHOLDER}
          </p>
        ) : projects.unlimited ? (
          <>
            <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--sl-teal)' }}>
              ∞
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {projects.used} owned, no cap
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {projects.used}{' '}
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                of {projects.max}
              </span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              projects owned
            </p>
            <div className="mt-2">
              <Meter
                value={projects.max ? projects.used / projects.max : 0}
                tone={projects.remaining === 0 ? 'red' : 'teal'}
                height={8}
              />
            </div>
          </>
        )}
      </Cell>

      <Cell
        testId="quota-ai"
        icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
        label="AI credits"
      >
        {!known ? (
          <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--text-muted)' }}>
            {PLACEHOLDER}
          </p>
        ) : ai.unlimited ? (
          <>
            <p className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--sl-teal)' }}>
              ∞
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Unlimited on this plan
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {ai.credits}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              interpretations available
            </p>
          </>
        )}
      </Cell>

      {known && tone !== 'ok' && (
        <Link
          href="/pricing"
          className="gl-card flex items-center justify-center p-4 text-xs font-semibold transition-colors hover:border-[var(--sl-purple)]"
          style={{ color: 'var(--sl-purple)' }}
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
