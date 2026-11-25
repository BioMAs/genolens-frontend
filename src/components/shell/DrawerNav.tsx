'use client';

import { useId } from 'react';
import Link from 'next/link';
import { BookOpen, Route } from 'lucide-react';
import QuotaDisplay from '@/components/QuotaDisplay';
import { useTour } from '@/contexts/TourContext';
import { DESTINATIONS, type DestinationKey } from '@/lib/navigation/destinations';
import { cn } from '@/lib/cn';

/**
 * Le contenu du tiroir de navigation, sous 60rem : les trois destinations, l'aide,
 * et — sous 40rem seulement — le solde de credits IA.
 *
 * `MobileNavToggle` le rend et le ferme ; ce composant ne connait ni l'etat
 * ouvert/ferme ni le bouton. Il est dans le DOM a toutes les largeurs et c'est le
 * CSS (`.app-drawer`) qui le masque a partir de 60rem, ou la barre reprend ces
 * entrees.
 *
 * La navigation s'appelle « Menu », pas « Main » : la barre porte deja un repere
 * « Main », et deux reperes de meme nom sont indistinguables au lecteur d'ecran.
 *
 * Le solde IA n'est affiche dans la barre qu'a partir de 40rem — en dessous, il
 * ne tient pas a cote de la recherche sans faire passer la barre sur deux
 * lignes. Il vit donc ici, et seulement ici, tant que la barre ne le montre pas.
 */
export default function DrawerNav({ active }: { active: DestinationKey | null }) {
  const { restartCurrentTour, currentTourId } = useTour();
  const helpId = useId();

  // Rangee de 44px : le minimum tactile, et ce tiroir n'existe que sur ecran tactile ou etroit.
  const rowClass =
    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-body font-medium transition-colors motion-reduce:transition-none';
  const restClass = 'text-secondary hover:bg-surface-2 hover:text-primary';

  return (
    <>
      <nav aria-label="Menu" className="flex flex-col gap-1 p-3">
        {DESTINATIONS.map(({ key, label, href }) => {
          const current = key === active;
          return (
            <Link
              key={key}
              href={href}
              aria-current={current ? 'page' : undefined}
              className={cn(rowClass, current ? 'bg-plum-soft text-plum' : restClass)}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Le groupe est nomme par son intitule visible : un `aria-label` en plus
          le ferait annoncer deux fois. */}
      <div role="group" aria-labelledby={helpId} className="flex flex-col gap-1 border-t border-subtle p-3">
        <p id={helpId} className="eyebrow px-3 pb-1">
          Help
        </p>
        {currentTourId && (
          <button type="button" onClick={restartCurrentTour} className={cn(rowClass, restClass)}>
            <Route className="h-4 w-4 shrink-0" aria-hidden />
            Take the tour
          </button>
        )}
        <Link href="/docs" className={cn(rowClass, restClass)}>
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          Documentation
        </Link>
      </div>

      <div className="mt-auto border-t border-subtle p-4 sm:hidden">
        <QuotaDisplay />
      </div>
    </>
  );
}
