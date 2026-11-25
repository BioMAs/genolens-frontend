'use client';

import * as React from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { LogOut, Moon, Shield, Sun, UserIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';

/**
 * Menu du compte de la barre du haut.
 *
 * Il fermait le pied de la sidebar : une rangee de 56px (avatar, nom, courriel,
 * chevrons) qui s'ouvrait vers le haut. Dans la barre du haut il devient une
 * pastille d'initiales de 36px — prune pleine, texte `on-accent`, qui s'inverse
 * avec elle en theme sombre — et il s'ouvre VERS LE BAS : un menu pose en haut de
 * la page qui s'ouvrirait vers le haut sortirait de l'ecran.
 *
 * Le nom et le courriel ne sont plus affiches en permanence : le declencheur les
 * porte dans son nom accessible, et le menu les rappelle en tete, ce qui est le
 * moment ou l'on en a besoin (« suis-je sur le bon compte ? »).
 *
 * L'entree Admin n'existe que pour un administrateur. Le role se lit comme la
 * sidebar le lisait (`userRole?.toLowerCase() === 'admin'`) : l'API garde la
 * decision, ce menu ne fait que ne pas proposer un lien qui renverrait un 403.
 *
 * L'avatar en degrade violet->teal a disparu avec l'ancienne version : c'etait le
 * dernier degrade de l'application authentifiee, et exactement l'« artefact
 * marketing pose sur une interface de donnees » que le commentaire de
 * DashboardWelcomeBanner condamne deja.
 */
export default function UserMenu({
  user,
  userRole = null,
}: {
  user: User;
  /** Role renvoye par le serveur. Absent : pas d'entree Admin. */
  userRole?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const signOutForm = React.useRef<HTMLFormElement>(null);
  const { theme, toggleTheme } = useTheme();

  const userName = user.email?.split('@')[0] || 'User';
  const initials = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'U';
  const isAdmin = userRole?.toLowerCase() === 'admin';

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      // Le menu s'ouvre depuis le declencheur : Echap doit y ramener le focus,
      // sinon un utilisateur au clavier le perd avec le menu qui disparait.
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-body-sm text-primary transition-colors hover:bg-hover';

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu, ${user.email ?? userName}`}
        onClick={() => setOpen((v) => !v)}
        // Le pseudo-element porte la zone de clic de 36 a 44px (4px de chaque
        // cote) sans grossir la pastille.
        className={cn(
          'relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-pill',
          'bg-plum text-caption font-semibold text-on-accent transition-colors hover:bg-plum-hover',
          'after:absolute after:-inset-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        )}
      >
        {initials}
      </button>

      {open && (
        // L'identite est A COTE du menu, pas dedans : un role="menu" ne contient
        // que des entrees (aria-required-children). La largeur est bornee par
        // l'ecran : un courriel long tronque au lieu de deborder a 375px.
        <div className="absolute right-0 top-full z-50 mt-2 w-max min-w-[14rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line bg-raised shadow-elev-2">
          <div className="border-b border-subtle px-3 py-2">
            <p className="truncate text-body-sm font-medium text-primary">{userName}</p>
            <p className="truncate text-caption text-muted">{user.email}</p>
          </div>

          <div role="menu" aria-label="Account" className="py-1">
            <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={itemClass}>
              <UserIcon className="h-4 w-4 shrink-0" aria-hidden />
              Profile
            </Link>

            <button type="button" role="menuitem" onClick={toggleTheme} className={itemClass}>
              {theme === 'light' ? (
                <Moon className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Sun className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
            </button>

            {isAdmin && (
              <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={itemClass}>
                <Shield className="h-4 w-4 shrink-0" aria-hidden />
                Admin
              </Link>
            )}

            {/* La deconnexion reste un POST vers /auth/signout : un GET
                deconnecterait l'utilisateur sur simple prefetch du navigateur.

                Pas de `onClick={() => setOpen(false)}` ici, contrairement aux
                autres entrees : React purge les evenements discrets de facon
                synchrone, donc le menu — et le <form> avec lui — quitterait le
                DOM avant que le navigateur ne declenche l'activation du bouton.
                Un submitter detache n'a plus de form owner : la soumission est
                abandonnee en silence et le clic ne fait rien. La navigation qui
                suit le POST ferme le menu de toute facon. */}
            <form ref={signOutForm} action="/auth/signout" method="post" className="contents">
              <button
                type="submit"
                role="menuitem"
                className={cn(itemClass, 'border-t border-subtle text-danger hover:bg-danger-soft')}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
