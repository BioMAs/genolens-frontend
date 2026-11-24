'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import CommandPaletteTrigger from '@/components/command/CommandPaletteTrigger';
import HelpTourButton from '@/components/onboarding/HelpTourButton';
import QuotaDisplay from '@/components/QuotaDisplay';
import UserMenu from '@/components/sidebar/UserMenu';
import { DESTINATIONS, resolveActiveDestination } from '@/lib/navigation/destinations';
import { cn } from '@/lib/cn';

interface TopNavProps {
  /** Le menu du compte en a besoin : AppShell, composant serveur, le lui passe. */
  user: User;
}

/**
 * La barre du haut : la marque, trois destinations, la recherche, puis l'aide,
 * le quota IA et le compte.
 *
 * Elle remplace la sidebar de gauche. Surface blanche, un filet dessous, 64px :
 * elle sert de repere a chaque ecran et ne doit pas peser plus que la page.
 *
 * Le contenu est centre dans 1360px comme la page, pour que la marque et le
 * titre partagent la meme marge gauche. Sous 720px l'ensemble passe a la ligne
 * (`flex-wrap`) au lieu de deborder : la recherche descend sous la navigation,
 * et le conteneur garde `min-h-16` plutot qu'une hauteur fixe.
 *
 * Le lien courant est prune sur fond prune doux ET porte `aria-current` : la
 * couleur seule ne dit rien a un lecteur d'ecran.
 *
 * L'image de marque est genolensLoupe.png, transparente. Jamais logo.png, dont
 * le fond blanc opaque dessinerait un carre sur cette surface — et sur
 * n'importe quelle autre en theme sombre.
 */
export default function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const active = resolveActiveDestination(pathname);

  return (
    <header className="border-b border-subtle bg-surface">
      <div className="mx-auto flex min-h-16 w-full max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:gap-x-8 md:px-10">
        <Link
          href="/dashboard"
          aria-label="GenoLens home"
          className="flex items-center gap-2 rounded-control text-[1.125rem] font-semibold tracking-[-0.01em] text-primary"
        >
          <Image
            src="/genolensLoupe.png"
            alt=""
            width={30}
            height={30}
            priority
            className="h-[30px] w-[30px] shrink-0"
          />
          <span>GenoLens</span>
        </Link>

        <nav aria-label="Main" data-tour="nav-workspace" className="flex gap-1">
          {DESTINATIONS.map(({ key, label, href }) => {
            const current = key === active;
            return (
              <Link
                key={key}
                href={href}
                aria-current={current ? 'page' : undefined}
                // Le pseudo-element porte la zone de clic de 40 a 44px sans
                // grossir la pastille.
                className={cn(
                  'relative inline-flex min-h-10 items-center rounded-control px-3 text-body font-medium transition-colors motion-reduce:transition-none',
                  'after:absolute after:inset-x-0 after:-inset-y-0.5',
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
          {/* Le menu d'aide (guide, documentation) prendra cette place ; en
              attendant, le bouton qui rejoue le guide de la page. */}
          <HelpTourButton />
          <QuotaDisplay />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
