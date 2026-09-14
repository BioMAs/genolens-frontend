'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import CommandPaletteTrigger from './command/CommandPaletteTrigger';
import HelpTourButton from './onboarding/HelpTourButton';
import MobileNavToggle from './MobileNavToggle';
import Breadcrumb from './Breadcrumb';
import { useBreadcrumbOverride } from '@/contexts/BreadcrumbContext';
import { resolveBreadcrumb } from '@/lib/navigation/breadcrumbs';
import { cn } from '@/lib/cn';

/**
 * Barre de contexte.
 *
 * Elle occupait 64px pour afficher UN mot de 16px, dont le <h1> se battait
 * contre sa propre classe avec quatre `!important`. Et ce n'etait pas que du
 * gaspillage : sur sept routes ce mot etait la meme chaine que le <h1> de la
 * page, donc de la duplication pure ; sur les autres, un nom generique
 * (« Project », « Comparison », « Guide ») qui n'apprenait rien.
 *
 * Elle porte desormais un fil d'Ariane — la seule information que la page
 * elle-meme ne donne pas : ou l'on se trouve dans la hierarchie, et comment
 * remonter.
 *
 * Elle ne porte PAS de bordure basse. Elle partage le fond de l'application, et
 * un filet n'apparait qu'une fois le contenu defile. C'est la signature la plus
 * reconnaissable de ce registre, pour une dizaine de lignes.
 */
export default function TopBar() {
  const pathname = usePathname();
  const override = useBreadcrumbOverride();
  const crumbs = override ?? resolveBreadcrumb(pathname);
  const [scrolled, setScrolled] = useState(false);

  // Le conteneur qui defile est `.app-content`, pas la fenetre : c'est lui qui
  // porte `overflow-y: auto` dans la coquille.
  useEffect(() => {
    const content = document.querySelector('.app-content');
    if (!content) return;
    const onScroll = () => setScrolled(content.scrollTop > 4);
    onScroll();
    content.addEventListener('scroll', onScroll, { passive: true });
    return () => content.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return (
    <header
      className={cn(
        'app-topbar border-b transition-colors',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Sous 768px la sidebar est un tiroir : c'est son unique ouverture. */}
        <MobileNavToggle />
        <Breadcrumb crumbs={crumbs} />
      </div>

      {/* La recherche occupait 400px fixes de chrome permanente pour une
          fonction occasionnelle. Ramenee a 240px, elle laisse la place au
          contexte, qui sert a chaque instant. */}
      <div className="hidden w-60 shrink-0 justify-center lg:flex">
        <CommandPaletteTrigger />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <HelpTourButton />
      </div>
    </header>
  );
}
