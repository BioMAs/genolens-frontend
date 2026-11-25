'use client';

import { BookOpen, HelpCircle, Route } from 'lucide-react';
import { OverflowMenu, type MenuItem } from '@/components/ui/menu';
import { useTour } from '@/contexts/TourContext';

/**
 * Le menu d'aide de la barre du haut : rejouer la visite de la page, ouvrir la
 * documentation.
 *
 * Il remplace `HelpTourButton`, un bouton qui ne faisait que la premiere de ces
 * deux choses — et qui disparaissait sur une route sans visite. L'aide a deux
 * entrees, donc un menu ; la documentation, qui n'est plus une destination de la
 * barre, y est TOUJOURS, et « Take the tour » n'y figure que si la page en a une.
 *
 * Il reutilise `OverflowMenu` (fermeture a Echap, au clic exterieur, a la
 * selection) plutot que de recopier une troisieme fois ce mecanisme. Seul le
 * declencheur est habille autrement : fantome, 36px, avec un pseudo-element qui
 * porte la zone de clic a 44px (4px de chaque cote) sans grossir le bouton.
 * `border-0` et non `border-transparent` : une bordure transparente de 1px
 * retrecirait la zone absolue de 2px, et 44 deviendrait 42.
 *
 * `data-tour="help-button"` est l'ancre de la visite du tableau de bord. Elle
 * est sur le declencheur : « Take the tour » n'existe dans le DOM que menu
 * ouvert, et driver.js cherche sa cible au repos.
 */
export default function HelpMenu({ className }: { className?: string }) {
  const { restartCurrentTour, currentTourId } = useTour();

  const items: MenuItem[] = [
    ...(currentTourId
      ? [
          {
            label: 'Take the tour',
            icon: <Route className="h-4 w-4 shrink-0" aria-hidden />,
            onSelect: restartCurrentTour,
          },
        ]
      : []),
    {
      label: 'Documentation',
      icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden />,
      href: '/docs',
    },
  ];

  return (
    <OverflowMenu
      label="Help"
      items={items}
      icon={<HelpCircle className="h-4 w-4" aria-hidden />}
      className={className}
      triggerClassName="relative h-9 w-9 border-0 bg-transparent hover:bg-surface-2 hover:text-primary after:absolute after:-inset-1"
      triggerData={{ 'data-tour': 'help-button' }}
    />
  );
}
