'use client';

/**
 * Le cadre de la fiche : un panneau à droite qui montre tout d'un gène ou d'un processus.
 *
 * **Non modal sur la page.** La fiche flotte à droite, sous la barre du haut : la lecture reste
 * atteignable, on peut cliquer un autre gène pendant qu'elle est ouverte. Elle est tout de même un
 * `dialog` nommé par son titre, et le focus y entre à l'ouverture — c'est ce qu'un lecteur au
 * clavier attend d'une fiche qu'il vient d'ouvrir. Échap la ferme, que le focus soit dans la
 * fiche ou nulle part (le corps de la page) ; un contrôle de la page qui a le focus garde son
 * Échap (un menu, un champ).
 *
 * **Modal au-dessus d'une vue agrandie.** `modal` est vrai quand une vue agrandie est ouverte : la
 * fiche passe alors au-dessus de sa boîte (`z-[10000]`, `ui/dialog`) avec un voile, annonce
 * `aria-modal` et retient Tab, comme la boîte qu'elle recouvre. Un clic sur le voile la ferme.
 *
 * **Le focus ne reste pas dans le vide.** Il revient à l'élément qui l'a ouverte quand elle se
 * ferme — ou, si cet élément est derrière une vue agrandie, à cette vue — pourvu qu'il soit tombé
 * sur le corps de la page. Et il rentre dans la fiche
 * quand son contenu change sous le lecteur (le gène cliqué dans la fiche d'un processus disparaît
 * avec elle) ou quand elle devient modale.
 *
 * **Le sujet, pas le titre.** Le focus rentre dans la fiche quand son SUJET change (`subject` : un
 * gène, un processus), jamais quand seul le titre change : une accession (`ENSG…`) devient un
 * symbole quand la carte des gènes arrive, c'est le même sujet, et le lecteur qui a cliqué dans la
 * page entre-temps ne se fait pas reprendre le focus. Le corps défilant est clé sur le sujet : un
 * autre gène ou processus s'ouvre en haut de la fiche, pas là où la précédente en était restée.
 *
 * **⌘K passe au-dessus.** La palette de commandes est à `z-[10003]`, au-dessus du voile et du
 * panneau modaux, et ses touches (Échap, Tab) sont les siennes : la fiche modale, qui les prend en
 * capture, les lui laisse (`data-command-palette`).
 *
 * Rendue dans un portail : un conteneur `transform` ou `overflow-hidden` de la page la couperait.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FOCUSABLE } from '@/components/ui/dialog';

interface InspectorSheetProps {
  /** Le nom du gène ou du processus : titre visible et nom accessible de la fiche. */
  title: string;
  /**
   * Ce dont la fiche parle, sous une forme qui ne change pas quand le titre se résout (la clé du
   * gène, l'identifiant du processus). Le focus et le défilement la suivent. Le titre, à défaut.
   */
  subject?: string;
  open: boolean;
  onClose: () => void;
  /** Vrai quand une vue agrandie est ouverte : la fiche passe au-dessus et retient le focus. */
  modal?: boolean;
  children?: ReactNode;
}

/**
 * Rend le focus là où le lecteur l'avait : l'élément qui a ouvert la fiche, s'il est encore là et
 * qu'aucune vue agrandie ne le recouvre ; sinon cette vue. La fiche elle-même (`panel`) n'est pas
 * une vue : elle peut encore être dans le DOM, quand le mode strict de React rejoue l'effet.
 *
 * **Un tick plus tard, et seulement si le focus est tombé sur le corps.** Quand la fiche se ferme
 * parce qu'une vue s'ouvre (le volcano la masque), cette fermeture et le montage de la boîte de la
 * vue ont lieu dans le même rendu : rendre le focus tout de suite le poserait sur la boîte toute
 * fraîche, qui retiendrait alors son propre panneau comme point de retour et laisserait tomber le
 * focus sur le corps à sa fermeture. Un tick plus tard, la boîte a pris son focus et le sien est
 * resté au bon endroit ; et un élément qui a reçu le focus entre-temps (un clic ailleurs) le garde.
 */
function restoreFocus(opener: HTMLElement | null, panel: HTMLElement | null) {
  setTimeout(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
    ).filter((dialog) => dialog !== panel);
    const under = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
    const usable = opener && opener !== document.body && opener.isConnected;
    if (usable && (!under || under.contains(opener))) {
      opener.focus();
    } else if (under) {
      under.focus();
    }
  }, 0);
}

export default function InspectorSheet({
  title,
  subject,
  open,
  onClose,
  modal = false,
  children,
}: InspectorSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subjectKey = subject ?? title;

  // `onClose` change à chaque rendu du parent : le lire par ref évite de rejouer les effets.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // L'élément d'origine, retenu à l'ouverture (avant que le focus n'entre dans la fiche).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && !panel?.contains(active) ? active : null;
    return () => restoreFocus(opener, panel);
  }, [open]);

  // Le focus entre dans la fiche à l'ouverture, quand elle devient modale et quand son sujet
  // change (un autre gène ou processus, pas un titre qui se résout) — sauf s'il y est déjà.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
  }, [open, modal, subjectKey]);

  // Les touches. Échap : dans la fiche, nulle part, ou n'importe où quand elle est modale ; sur la
  // page, un contrôle qui a déjà traité la touche (`defaultPrevented`) ou qui a le focus la garde.
  // Tab, modale seulement : le focus boucle dans la fiche, et y rentre s'il s'en est écarté.
  //
  // Modale, la fiche écoute en capture : elle passe avant la boîte de la vue agrandie, qui ferme sur
  // Échap et retient Tab, et où le focus peut se trouver (le mode strict de React rejoue les effets
  // de cette boîte après les nôtres) — la fiche se ferme d'abord, la vue dessous reste.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // ⌘K ouvert par-dessus la fiche : Échap le ferme lui, et son Tab reste chez lui.
      if (event.target instanceof Element && event.target.closest('[data-command-palette]')) return;
      const panel = panelRef.current;
      const active = document.activeElement;

      if (event.key === 'Escape') {
        const ours = modal || !active || active === document.body || !!panel?.contains(active);
        if (!ours) return;
        event.preventDefault();
        if (modal) event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (!modal || event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusables[0] ?? panel;
      const last = focusables[focusables.length - 1] ?? panel;
      let target: HTMLElement | null = null;
      if (!panel.contains(active)) {
        target = event.shiftKey ? last : first;
      } else if (event.shiftKey && (active === first || active === panel)) {
        target = last;
      } else if (!event.shiftKey && active === last) {
        target = first;
      }
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      target.focus();
    };
    document.addEventListener('keydown', onKeyDown, modal);
    return () => document.removeEventListener('keydown', onKeyDown, modal);
  }, [open, modal]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {modal && (
        <div
          data-testid="sheet-backdrop"
          aria-hidden
          className="fixed inset-0 z-[10001] bg-[rgb(0_0_0/.35)]"
          onMouseDown={() => onCloseRef.current()}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={modal ? 'true' : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed right-0 flex w-full max-w-[26rem] flex-col border-l border-line bg-surface shadow-elev-2 focus:outline-none',
          // Sur la page : sous la barre du haut (z-40), au-dessus du menu flottant (z-30). Au-dessus
          // d'une vue agrandie : toute la hauteur, et plus haut que sa boîte (z-[10000]) et son voile.
          modal ? 'inset-y-0 z-[10002]' : 'bottom-0 top-[var(--sticky-top)] z-40'
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <h2 id={titleId} className="min-w-0 break-words text-title text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close panel"
            // Cible de 44 px (minimum tactile), recentrée par la marge négative.
            className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div
          key={subjectKey}
          data-testid="sheet-body"
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
