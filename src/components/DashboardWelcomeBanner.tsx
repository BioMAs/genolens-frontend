'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import type { AggregatedStats } from '@/hooks/useUserDashboardStats';

/**
 * En-tete du dashboard.
 *
 * Ce bloc etait un bandeau decoratif : degrade emerald-vers-indigo et 220
 * cercles SVG generes en douce forme de nuage de volcan. C'etait la seule
 * surface degradee de l'ecran, et elle se lisait comme un artefact marketing
 * pose au-dessus d'une interface de donnees. Le degrade et le nuage sont
 * supprimes ; la hierarchie passe desormais par la taille et le poids du
 * texte, ce qui est aussi ce qui permet de le lire d'un coup d'oeil.
 *
 * Il absorbe au passage la barre de KPI, qui occupait une rangee pleine
 * largeur pour trois totaux. Deux d'entre eux tiennent dans le sous-titre ;
 * « Activity (7d) » a ete abandonne — c'est une metrique de vanite, elle ne
 * declenche aucune action.
 *
 * Une seule action, comme avant : reprendre, ou lire les guides. La creation
 * de projet appartient a l'en-tete des projets recents.
 */
interface DashboardWelcomeBannerProps {
  userName?: string;
  /** Nom du projet a reprendre. Absent = aucun projet. */
  recentProjectName?: string;
  /** Lien de reprise. Absent = la CTA pointe vers /docs. */
  resumeHref?: string;
  stats?: AggregatedStats;
  statsLoading?: boolean;
}

function getFirstName(name?: string): string | null {
  if (!name) return null;
  if (name.includes('@')) return name.split('@')[0];
  return name.split(' ')[0];
}

export default function DashboardWelcomeBanner({
  userName,
  recentProjectName,
  resumeHref,
  stats,
  statsLoading = false,
}: DashboardWelcomeBannerProps) {
  const firstName = getFirstName(userName);
  const comparisons = stats?.total_comparisons ?? 0;
  const degs = stats?.total_deg_genes ?? 0;
  const hasProduced = !statsLoading && (comparisons > 0 || degs > 0);

  return (
    /* Le tableau de bord est l'exception assumee : cette salutation n'est pas
       un en-tete de page, donc elle ne passe pas par `PageHeader`. Elle prend
       en revanche le meme CRAN de titre — `text-display` — sinon le seul ecran
       a ne pas l'utiliser serait aussi le premier qu'on voit, et la hierarchie
       du produit y demarrerait un cran plus bas qu'ailleurs. */
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-display text-primary">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>

        {/* Le tour pointe une etape « Key metrics » sur cette ancre. Elle
            designait une rangee de trois pastilles ; elle designe desormais
            cette ligne, ce que la description de l'etape decrit toujours. */}
        <p data-tour="dashboard-kpis" className="mt-1 text-body-sm text-secondary">
          {hasProduced ? (
            <>
              <b className="font-semibold tabular-nums text-primary">
                {comparisons.toLocaleString()}
              </b>{' '}
              {comparisons === 1 ? 'comparison' : 'comparisons'} ·{' '}
              <b className="font-semibold tabular-nums text-primary">
                {degs.toLocaleString()}
              </b>{' '}
              differentially expressed genes
            </>
          ) : recentProjectName ? (
            <>
              Pick up where you left off in <b className="text-primary">{recentProjectName}</b>.
            </>
          ) : (
            'Start with the guides — they walk through an analysis end to end.'
          )}
        </p>
      </div>

      {resumeHref ? (
        <Link href={resumeHref} className={buttonClasses({ className: 'shrink-0' })}>
          {/* Un nom de projet va jusqu'a 255 caracteres : sans borne, le bouton
              s'etirait hors de sa colonne et faisait deborder la page. */}
          <span className="max-w-[16ch] truncate sm:max-w-[24ch]" title={recentProjectName}>
            Resume {recentProjectName}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ) : (
        <Link href="/docs" className={buttonClasses({ className: 'shrink-0' })}>
          <BookOpen className="h-3.5 w-3.5" />
          Read the guides
        </Link>
      )}
    </header>
  );
}
