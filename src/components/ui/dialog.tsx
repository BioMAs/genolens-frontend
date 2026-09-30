'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * La modale du produit.
 *
 * Quatorze fenetres reconstruisaient leur propre `fixed inset-0`, et chacune
 * oubliait une partie du contrat : aucune n'annoncait `role="dialog"`, aucune ne
 * se fermait a Echap, aucune ne retenait le focus, et la plupart debordaient de
 * l'ecran d'un telephone en paysage sans pouvoir defiler. Ce composant porte ce
 * contrat une fois — le modele est celui de `CommandPalette`, la seule qui le
 * respectait deja :
 *
 *   - `role="dialog"`, `aria-modal`, nom accessible tire du titre ;
 *   - Echap ferme, le clic sur le voile aussi (sauf `dismissible={false}`) ;
 *   - Tab boucle dans la boite, le focus y entre a l'ouverture et revient au
 *     declencheur a la fermeture ;
 *   - le panneau ne depasse jamais la hauteur visible et defile lui-meme ;
 *   - le defilement de la page est bloque derriere.
 *
 * Rendu dans un portail : une modale imbriquee dans un conteneur `transform` ou
 * `overflow-hidden` y est sinon coupee ou repositionnee.
 */

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Titre visible, et nom accessible de la boite. */
  title: React.ReactNode;
  /** Sous-titre facultatif, relie par `aria-describedby`. */
  description?: React.ReactNode;
  /** Icone ou pastille placee avant le titre. */
  icon?: React.ReactNode;
  size?: DialogSize;
  /**
   * `false` pendant une operation qu'on ne doit pas interrompre (suppression,
   * envoi) : Echap, le voile et la croix sont alors sans effet.
   */
  dismissible?: boolean;
  /** Element a focaliser a l'ouverture ; a defaut, le premier focalisable du corps. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Barre d'actions, alignee a droite sous un filet. */
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  dismissible = true,
  initialFocusRef,
  footer,
  className,
  bodyClassName,
  children,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  // onClose change a chaque rendu du parent : le lire par ref evite de rejouer
  // l'effet d'ouverture (et donc de voler le focus) a chaque frappe.
  const onCloseRef = React.useRef(onClose);
  const dismissibleRef = React.useRef(dismissible);
  React.useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  const requestClose = React.useCallback(() => {
    if (dismissibleRef.current) onCloseRef.current();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;

    // Le premier champ plutot que la croix : on ouvre une modale pour y agir.
    const target =
      initialFocusRef?.current ??
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panelRef.current;
    target?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      returnTo?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Une modale ouverte depuis une autre ne doit fermer qu'elle-meme.
      event.stopPropagation();
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      /* Meme etage que la palette de commandes : le bandeau de licence monte a
         z-9999, et une modale recouverte par une banniere n'en est plus une. */
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[rgb(0_0_0/.45)]"
        aria-hidden
        data-testid="dialog-backdrop"
        onMouseDown={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-card bg-surface shadow-elev-2 ring-1 ring-line',
          // dvh et non vh : sur mobile, vh inclut la barre d'adresse et la
          // boite passe dessous.
          'max-h-[calc(100dvh-2rem)] focus:outline-none',
          SIZES[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-subtle px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon}
            <div className="min-w-0">
              <h2 id={titleId} className="text-title text-primary">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-body-sm text-secondary">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!dismissible}
            aria-label="Close dialog"
            /* Cible de 44px (minimum tactile), recentree par la marge negative. */
            className={cn(
              '-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill',
              'text-secondary transition-colors hover:bg-hover hover:text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div
          ref={bodyRef}
          className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-subtle px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
