'use client';

import * as React from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { ChevronsUpDown, LogOut, Moon, Sun, UserIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';

/**
 * Menu utilisateur du pied de sidebar.
 *
 * Le pied comptait trois bandes empilees (~120px) : quotas, profil, puis une
 * rangee « Theme / Sign out » faite de deux `.nav-item` qui devaient neutraliser
 * leur propre marge avec `!m-0`. Deux boutons permanents pour des actions
 * consultees quelques fois par mois.
 *
 * L'avatar en degrade violet->teal disparait au passage. C'etait le dernier
 * degrade de l'application authentifiee, et exactement l'« artefact marketing
 * pose sur une interface de donnees » que le commentaire de
 * DashboardWelcomeBanner condamne deja.
 */
export default function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const signOutForm = React.useRef<HTMLFormElement>(null);
  const { theme, toggleTheme } = useTheme();

  const userName = user.email?.split('@')[0] || 'User';
  const initials = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'U';

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
    <div ref={root} className="relative mx-2">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-14 w-full cursor-pointer items-center gap-3 rounded-control px-2.5 text-left',
          'transition-colors hover:bg-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        {/* Cercle plat : le degrade etait le dernier de l'app authentifiee. */}
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-surface-2 text-micro text-secondary">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-caption font-medium text-primary">{userName}</span>
          <span className="block truncate text-micro text-muted">{user.email}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-card bg-raised py-1 shadow-elev-2"
        >
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
      )}
    </div>
  );
}
