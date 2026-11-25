'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import ProjectSwitcher from '@/components/sidebar/ProjectSwitcher';
import { useScientificModule } from '@/hooks/useAddOnModules';
import { useProject } from '@/hooks/useProjects';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  buildProjectNav,
  isProjectLevelRoute,
  resolveActiveProjectTab,
} from '@/lib/navigation/projectNav';
import { canUseMultiComparison } from '@/utils/plan';
import { cn } from '@/lib/cn';

/**
 * Le gabarit d'un onglet : 44px de haut (`min-h-11`), sur une ligne (`whitespace-nowrap`),
 * sans jamais retrecir (`shrink-0`) — c'est la rangee qui defile, pas l'onglet qui se coupe.
 */
const TAB =
  'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-control px-4 text-body font-medium transition-colors motion-reduce:transition-none';

/**
 * La barre du projet : le selecteur de projet, puis une rangee d'onglets —
 * Overview, Setup, Analyses, Multi-comparison, Contrast scatter.
 *
 * Elle remplace le groupe « Project » de la sidebar, que la barre du haut a
 * supprimee : sans elle, ces cinq pages n'etaient plus joignables que par les
 * liens d'une page a l'autre. Le layout de `/projects/[id]` la monte ; elle se
 * rend elle-meme invisible (`null`) hors des routes de projet — sur une analyse,
 * une comparaison ou un dataset, le fil d'Ariane ramene en arriere, et une
 * rangee d'onglets de projet y mentirait sur ou l'on est. Le layout persiste
 * d'un onglet a l'autre : la rangee ne se remonte pas, et son defilement non plus.
 *
 * Elle est posee juste sous le fil d'Ariane, sur la MEME mesure et les memes
 * gouttieres (`--measure-default`, `--page-gutter`) : son bord gauche est celui
 * du fil. `shell.test.ts` exige que les deux citent les memes jetons.
 *
 * Les onglets suivent la maquette : un filet de 1px dessous, l'onglet courant en
 * prune avec 3px de soulignement, 44px de haut (le minimum tactile). Ce sont des
 * LIENS, pas un `tablist` : chaque onglet est une page, pas un panneau de la
 * meme page — le courant porte `aria-current="page"`. Sur ecran etroit la rangee
 * defile lateralement au lieu de passer a la ligne, et l'onglet courant est
 * ramene dans le champ.
 *
 * Un onglet verrouille n'est pas un lien mais un `<span aria-disabled="true">` :
 * cadenas, raison en infobulle ET en texte pour lecteur d'ecran. Deux raisons
 * independantes (un droit de plan, une option activee par l'admin) : l'infobulle
 * dit laquelle, voir `buildProjectNav`.
 *
 * Le selecteur est HORS du defilement : le menu qu'il ouvre est en position
 * absolue, et un `overflow-x: auto` le rognerait.
 */
export default function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const visible = isProjectLevelRoute(pathname);
  const active = resolveActiveProjectTab(pathname);

  const { unlocked: scienceUnlocked } = useScientificModule();
  const { data: planProfile, isPending: profilePending } = useUserProfile();
  // Le nom n'est demande que la ou la rangee est rendue.
  const { data: project } = useProject(projectId, visible);
  const scroller = useRef<HTMLElement>(null);

  // Tant que `/users/me` n'a pas repondu, les deux verrous ne sont PAS connus : le droit de
  // plan et l'option valent `false` faute de profil, et les lire tels quels peignait un cadenas
  // et « ask an admin to enable it » a un utilisateur qui y a droit. Un verrou inconnu n'est donc
  // pas pose. La rangee se corrige a l'arrivee du profil ; si la requete echoue, `isPending`
  // retombe et les verrous reviennent (fermes par defaut).
  const items = buildProjectNav(projectId, {
    canMulti: profilePending || canUseMultiComparison(planProfile),
    canScatter: profilePending || scienceUnlocked,
  });
  // L'onglet courant, UNIQUEMENT s'il est un lien : verrouille, il n'a pas d'`aria-current`.
  const currentLink = items.find((item) => item.key === active && item.lockedReason === null)?.key ?? null;

  // Arrivee directe sur un onglet hors du champ (Contrast scatter a 375px) :
  // on le ramene au centre. Le defilement est celui de la rangee, jamais celui de
  // la page — `scrollIntoView` ferait aussi bouger le document.
  //
  // La dependance est l'onglet courant EN TANT QUE LIEN, pas la route : un onglet de plan ou
  // d'option est d'abord un span verrouille, sans `aria-current`, puis un lien quand le profil
  // arrive ou change — la route, elle, n'a pas bouge, et l'effet ne se relancerait jamais.
  useEffect(() => {
    const row = scroller.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current) return;
    const left = current.offsetLeft;
    const right = left + current.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = left - (row.clientWidth - current.offsetWidth) / 2;
    }
  }, [currentLink, visible]);

  if (!visible) return null;

  // Le nom humain du projet ; l'id le temps qu'il charge.
  const projectLabel = project?.name ?? decodeURIComponent(projectId);

  return (
    <div className="mx-auto w-full max-w-[var(--measure-default)] px-[var(--page-gutter)] pt-2 md:pt-3">
      {/* Le point du selecteur (12px de marge interne) est ramene sur le bord du fil. */}
      <ProjectSwitcher
        projectId={projectId}
        projectLabel={projectLabel}
        className="mx-0 -ml-3 w-72 max-w-full"
      />

      {/* Le filet est sur l'enveloppe ; la rangee le chevauche de 1px (-mb-px) pour que
          le soulignement de l'onglet courant le recouvre, comme dans la maquette. */}
      <div className="mt-1 border-b border-line">
        <nav
          ref={scroller}
          aria-label="Project"
          data-tour="nav-project"
          className="relative -mb-px flex gap-1 overflow-x-auto"
        >
          {items.map(({ key, label, href, lockedReason }) => {
            if (lockedReason !== null) {
              return (
                <span
                  key={key}
                  aria-disabled="true"
                  title={lockedReason}
                  className={cn(TAB, 'cursor-not-allowed text-muted opacity-60')}
                >
                  {label}
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="sr-only"> — {lockedReason}</span>
                </span>
              );
            }
            const current = key === active;
            return (
              <Link
                key={key}
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  TAB,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                  current
                    ? 'text-plum after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-sm after:bg-plum'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
