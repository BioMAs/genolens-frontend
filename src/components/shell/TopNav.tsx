'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppUser } from '@/utils/auth/types';
import CommandPaletteTrigger from '@/components/command/CommandPaletteTrigger';
import MobileNavToggle from '@/components/MobileNavToggle';
import QuotaDisplay from '@/components/QuotaDisplay';
import UserMenu from '@/components/sidebar/UserMenu';
import DrawerNav from '@/components/shell/DrawerNav';
import HelpMenu from '@/components/shell/HelpMenu';
import { DESTINATIONS, resolveActiveDestination } from '@/lib/navigation/destinations';
import { cn } from '@/lib/cn';

interface TopNavProps {
  /** Le menu du compte en a besoin : AppShell, composant serveur, le lui passe. */
  user: AppUser;
  /** Role renvoye par le serveur : le menu du compte n'offre « Admin » qu'a un admin. */
  userRole?: string | null;
}

/** Defilement de la fenetre au-dela duquel le filet se renforce. */
const SCROLL_THRESHOLD = 4;

/**
 * La barre du haut : la marque, trois destinations, la recherche, puis l'aide, le
 * quota IA et le compte.
 *
 * Elle remplace la sidebar de gauche. Surface blanche, un filet dessous, 64px
 * (`--topbar-height`) : elle sert de repere a chaque ecran et ne doit pas peser
 * plus que la page. Elle est COLLEE en haut (`sticky`) et c'est le document qui
 * defile dessous ; le contenu qui se colle a son tour — la carte de selection, un
 * onglet — se cale sur `--sticky-top`, qui vaut cette hauteur.
 *
 * Le contenu est centre dans 1360px (gouttieres de 16px puis 40px), la mesure de
 * la maquette ; le fil d'Ariane, lui, prend celle de la page qu'il surplombe
 * (`PageBreadcrumb`). La barre tient sur UNE ligne a toutes les
 * largeurs, hauteur fixe : c'est la condition pour que `--sticky-top` dise vrai.
 * Sous 60rem les destinations et l'aide quittent la barre pour le tiroir de
 * `MobileNavToggle` ; la recherche reste, et le solde IA passe dans le tiroir
 * sous 40rem.
 *
 * Le lien courant est prune sur fond prune doux ET porte `aria-current` : la
 * couleur seule ne dit rien a un lecteur d'ecran.
 *
 * Le filet est present au repos et se renforce une fois la page defilee, pour
 * separer la barre de ce qui glisse dessous.
 *
 * L'image de marque est genolensLoupe.png, transparente. Jamais logo.png, dont
 * le fond blanc opaque dessinerait un carre sur cette surface — et sur
 * n'importe quelle autre en theme sombre.
 *
 * Empilement : z-40, au-dessus du contenu et de ses bandeaux collés (z-30), sous
 * la palette de commandes et les dialogues (z-[10000]). Les menus (aide, compte,
 * tiroir) sont poses DANS la barre, donc dans son contexte d'empilement.
 */
export default function TopNav({ user, userRole = null }: TopNavProps) {
  const pathname = usePathname();
  const active = resolveActiveDestination(pathname);
  const [scrolled, setScrolled] = useState(false);

  // C'est le document qui defile, pas un conteneur : la fenetre est l'ecouteur.
  // On lit aussi la position au montage — un retour arriere restaure la page a
  // mi-hauteur avant que la barre n'existe, et aucun evenement ne suivra.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        // La hauteur est portee par la barre, bordure comprise (border-box) :
        // posee sur la ligne interieure, la barre ferait 65px et le contenu
        // colle sous elle (`--sticky-top`) mordrait d'un pixel sous son filet.
        'sticky top-0 z-40 h-[var(--topbar-height)] border-b bg-surface transition-colors motion-reduce:transition-none',
        scrolled ? 'border-strong' : 'border-subtle',
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-[1360px] items-center gap-4 px-4 min-[60rem]:gap-8 md:px-10">
        <MobileNavToggle>
          <DrawerNav active={active} />
        </MobileNavToggle>

        <Link
          href="/dashboard"
          aria-label="GenoLens home"
          className="flex shrink-0 items-center gap-2 rounded-control text-primary"
        >
          <Image
            src="/genolensLoupe.png"
            alt=""
            width={30}
            height={30}
            priority
            className="h-[30px] w-[30px] shrink-0"
          />
          {/* Sous 30rem la loupe seule : le nom ne tient pas a cote de la recherche. */}
          <span className="hidden text-title min-[30rem]:inline">GenoLens</span>
        </Link>

        <nav
          aria-label="Main"
          data-tour="nav-workspace"
          className="hidden gap-1 min-[60rem]:flex"
        >
          {DESTINATIONS.map(({ key, label, href }) => {
            const current = key === active;
            return (
              <Link
                key={key}
                href={href}
                aria-current={current ? 'page' : undefined}
                // Pastille de 36px, sur l'echelle des hauteurs de controle ; le
                // pseudo-element porte la zone de clic a 44px sans la grossir.
                className={cn(
                  'relative inline-flex min-h-9 items-center rounded-control px-3 text-body font-medium transition-colors motion-reduce:transition-none',
                  'after:absolute after:inset-x-0 after:-inset-y-1',
                  current
                    ? 'bg-plum-soft text-plum'
                    : 'text-secondary hover:bg-surface-2 hover:text-primary',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* `ml-auto` repousse la recherche (et ce qui la suit) a droite ; elle
            grossit jusqu'a 460px, puis c'est l'espace libre qui s'allonge. */}
        <div className="ml-auto flex min-w-0 max-w-[460px] flex-[1_1_320px]">
          <CommandPaletteTrigger />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <HelpMenu className="hidden min-[60rem]:block" />
          <div className="hidden sm:block">
            <QuotaDisplay />
          </div>
          <UserMenu user={user} userRole={userRole} />
        </div>
      </div>
    </header>
  );
}
