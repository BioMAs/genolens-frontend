'use client';

import Link from 'next/link';
import { ChevronRight, GitCompareArrows } from 'lucide-react';
import { pairKey } from './helix/helixGeometry';
import { useChartPalette } from '@/utils/chartTheme';
import { formatRelative, comparisonTitle } from './format';
import type { UserComparisonItem } from '@/hooks/useAllComparisons';

/**
 * Les derniers resultats, tous projets confondus.
 *
 * C'est la version LISIBLE de l'helice : memes comparaisons, memes couleurs,
 * avec les chiffres et un vrai lien. Les deux sont lies — survoler ou
 * focaliser une ligne fait tourner l'helice jusqu'a presenter la paire
 * correspondante, et survoler une paire surligne sa ligne. C'est aussi par
 * ici que passe le clavier : l'helice n'a pas de tabulation propre.
 *
 * La barre divergente part d'un axe central : sous-exprimes a gauche, sur-
 * exprimes a droite, a l'echelle de la plus grande valeur affichee. On
 * compare donc d'un coup d'oeil l'AMPLEUR et le SENS de chaque reponse.
 */

interface LatestResultsProps {
  items: UserComparisonItem[];
  loading: boolean;
  activeKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
  /** Ou mener l'utilisateur quand il n'a encore aucun resultat. */
  emptyAction?: React.ReactNode;
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-2/5" />
        <div className="skeleton h-3 w-1/4" />
      </div>
      <div className="skeleton hidden h-2 w-36 sm:block" />
    </div>
  );
}

export default function LatestResults({
  items,
  loading,
  activeKey,
  onActiveKeyChange,
  emptyAction,
}: LatestResultsProps) {
  const palette = useChartPalette();
  const scale = Math.max(1, ...items.map((c) => Math.max(c.deg_up, c.deg_down)));

  return (
    <section aria-labelledby="latest-results-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="latest-results-title" className="text-title text-primary">
          Latest results
        </h2>
        <Link href="/comparisons" className="text-caption font-medium text-accent-ink hover:underline">
          All comparisons →
        </Link>
      </div>

      <div className="gl-card overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="divide-y divide-[var(--border)]">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body-sm font-semibold text-primary">No results yet</p>
              <p className="mt-1 max-w-[52ch] text-caption text-secondary">
                Your first comparison lands here — and as the first base pair of your helix.
              </p>
            </div>
            {emptyAction}
          </div>
        ) : (
          // `data-enter` : les lignes arrivent en cascade bornee, et leurs barres
          // poussent juste apres — le decalage vit dans globals.css, sur le
          // conteneur, pas en style en ligne.
          <ul data-enter className="divide-y divide-[var(--border)]">
            {items.map((c) => {
              const key = pairKey(c);
              const active = activeKey === key;
              const upW = (c.deg_up / scale) * 100;
              const downW = (c.deg_down / scale) * 100;
              return (
                <li key={key}>
                  <Link
                    href={`/projects/${c.project_id}/comparisons/${encodeURIComponent(c.name)}`}
                    onPointerEnter={() => onActiveKeyChange(key)}
                    onPointerLeave={() => onActiveKeyChange(null)}
                    onFocus={() => onActiveKeyChange(key)}
                    onBlur={() => onActiveKeyChange(null)}
                    data-active={active || undefined}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)] data-[active]:bg-[var(--hover-overlay)]"
                  >
                    <GitCompareArrows className="h-4 w-4 shrink-0 text-muted" aria-hidden />

                    <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1fr)_9.5rem_8.5rem]">
                      {/* Identite */}
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-primary">
                          {comparisonTitle(c.name)}
                        </p>
                        <p className="mt-1 truncate text-caption text-muted">
                          {c.project_name}
                          <span aria-hidden> · </span>
                          {formatRelative(c.updated_at)}
                          {c.has_enrichment && (
                            <>
                              <span aria-hidden> · </span>
                              <span className="text-success">Enriched</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Barre divergente : down | axe | up */}
                      <div className="hidden h-2 items-center sm:flex" aria-hidden>
                        <div className="flex h-full flex-1 justify-end">
                          <div
                            className="gl-grow-x h-full rounded-l-sm"
                            style={{ width: `${downW}%`, background: palette.down, transformOrigin: 'right' }}
                          />
                        </div>
                        <div className="mx-px h-3 w-px" style={{ background: 'var(--border-strong)' }} />
                        <div className="flex h-full flex-1">
                          <div
                            className="gl-grow-x h-full rounded-r-sm"
                            style={{ width: `${upW}%`, background: palette.up, transformOrigin: 'left' }}
                          />
                        </div>
                      </div>

                      {/* Chiffres */}
                      <p className="flex items-center gap-3 text-caption tabular-nums text-secondary sm:justify-end">
                        <span>
                          <span aria-hidden style={{ color: palette.up }}>▲</span>
                          <span className="sr-only">Up</span> {c.deg_up.toLocaleString('en-US')}
                        </span>
                        <span>
                          <span aria-hidden style={{ color: palette.down }}>▼</span>
                          <span className="sr-only">Down</span> {c.deg_down.toLocaleString('en-US')}
                        </span>
                      </p>
                    </div>

                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
