'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Menu de depassement.
 *
 * Une barre d'actions qui aligne cinq a sept boutons de meme poids n'a pas de
 * hierarchie : tout y est secondaire, donc rien n'est primaire, et l'oeil n'a
 * aucun point d'entree. Le remede n'est pas de re-styler ces boutons mais de
 * n'en garder qu'un ou deux et de replier le reste ici.
 *
 * Un element verrouille reste VISIBLE et desactive, avec sa raison en
 * infobulle : le masquer laisserait croire que la fonctionnalite n'existe pas.
 */
export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  /** Navigation. Exclusif avec `onSelect`. */
  href?: string;
  onSelect?: () => void;
  /** Verrouille : rendu en desactive, avec `lockedHint` en infobulle. */
  locked?: boolean;
  lockedHint?: string;
}

interface OverflowMenuProps {
  items: MenuItem[];
  label?: string;
  className?: string;
  /**
   * Icone du declencheur. Par defaut les trois points du depassement.
   *
   * Un menu dont TOUTES les entrees relevent d'une meme action — exporter, par
   * exemple — se signale mieux par l'icone de cette action : sinon l'utilisateur
   * doit ouvrir pour savoir. La logique de fermeture, d'Echap et de focus reste
   * partagee, ce qui est la seule raison de ne pas ecrire un second composant.
   */
  icon?: React.ReactNode;
}

export function OverflowMenu({ items, label = 'More actions', className, icon }: OverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape doit fermer le menu : sans cela un utilisateur au clavier n'a
    // aucun moyen d'en sortir sans deplacer le focus hors du composant.
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

  if (!items.length) return null;

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-primary transition-colors hover:bg-hover';

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-control',
          'border border-line bg-surface text-secondary transition-colors',
          'hover:border-strong hover:bg-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        )}
      >
        {icon ?? <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-50 mt-2 min-w-[13rem] overflow-hidden py-1',
            'rounded-card border border-line bg-raised shadow-elev-2',
          )}
        >
          {items.map((item) => {
            if (item.locked) {
              return (
                <span
                  key={item.label}
                  role="menuitem"
                  aria-disabled
                  title={item.lockedHint}
                  className={cn(itemClass, 'cursor-not-allowed text-muted opacity-60')}
                >
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </span>
              );
            }
            if (item.href) {
              return (
                <Link
                  key={item.label}
                  role="menuitem"
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(itemClass, 'cursor-pointer')}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
