'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Crumb } from '@/lib/navigation/breadcrumbs';

/**
 * Le fil d'Ariane de la barre de contexte.
 *
 * Repliement : au-dela de trois miettes, celles du milieu se replient en `…`.
 * On garde toujours la premiere (la racine, qui situe) et les deux dernieres
 * (le parent immediat et la page) — ce sont celles qui portent l'information.
 *
 * Seule la derniere tronque, et elle porte son texte complet en infobulle :
 * un nom de comparaison peut aller jusqu'a 255 caracteres et pousserait sinon
 * la barre hors de l'ecran.
 */
export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;

  const collapsed = crumbs.length > 3;
  const shown: (Crumb | 'ellipsis')[] = collapsed
    ? [crumbs[0], 'ellipsis', crumbs[crumbs.length - 2], crumbs[crumbs.length - 1]]
    : crumbs;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1">
        {shown.map((crumb, index) => {
          const isLast = index === shown.length - 1;

          if (crumb === 'ellipsis') {
            return (
              <li key="ellipsis" className="flex shrink-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                {/* Les miettes repliees restent annoncees : un lecteur d'ecran
                    doit pouvoir connaitre la profondeur reelle du chemin. */}
                <span className="px-1 text-body-sm text-muted" title={crumbs.map((c) => (c as Crumb).label).join(' › ')}>
                  …
                </span>
              </li>
            );
          }

          return (
            <li key={`${crumb.label}-${index}`} className={cn('flex items-center gap-1', isLast && 'min-w-0')}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="shrink-0 rounded-sm px-1 text-body-sm text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  title={crumb.label}
                  className={cn(
                    'px-1 text-body-sm',
                    isLast ? 'truncate font-semibold text-primary' : 'shrink-0 text-secondary',
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
