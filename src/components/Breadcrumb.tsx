'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Crumb } from '@/lib/navigation/breadcrumbs';

/**
 * Le fil d'Ariane, premiere ligne du contenu (`PageBreadcrumb` le monte).
 *
 * Discret : les miettes liees sont en gris attenue, seule la page courante est
 * en encre. Il situe le titre qu'il surplombe sans lui disputer l'attention.
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
            // La racine garde sa largeur ; les autres miettes se partagent le
            // reste et tronquent. Sans `min-w-0` sur l'<li> et `truncate` sur le
            // texte, a 375px la miette du milieu debordait de son <li> et
            // passait sous le chevron de la derniere.
            <li key={`${crumb.label}-${index}`} className={cn('flex items-center gap-1', index > 0 && 'min-w-0')}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  title={crumb.label}
                  className={cn(
                    'rounded-sm px-1 text-body-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    index === 0 ? 'shrink-0' : 'min-w-0 truncate',
                  )}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  title={crumb.label}
                  className={cn(
                    'px-1 text-body-sm',
                    isLast ? 'truncate font-medium text-primary' : 'min-w-0 truncate text-muted',
                    index === 0 && 'shrink-0',
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
