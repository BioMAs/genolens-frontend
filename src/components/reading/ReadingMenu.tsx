'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { List, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { READING_PARTS, type ReadingPart, type ReadingPartInfo } from './readingRoutes';

interface ReadingMenuProps {
  /** The part being read, from `useActivePart`. */
  active: ReadingPart;
  /** The parts the plan does not include: still listed, marked, and still followed. */
  locked: Partial<Record<ReadingPart, boolean>>;
  /** Where a part's link goes: a fragment on the reading page, or a full path. */
  hrefFor: (part: ReadingPart) => string;
}

/** The parts the menu lists at the top level; the applications hang under their parent. */
const TOP_LEVEL = READING_PARTS.filter((p) => !p.parent);
const childrenOf = (id: ReadingPart) => READING_PARTS.filter((p) => p.parent === id);

const NOT_IN_PLAN = 'not in your plan';

const LINK =
  'flex items-center gap-2 rounded-control px-3 py-2 text-body-sm transition-colors motion-reduce:transition-none';

/**
 * Le menu flottant de la lecture : un lien par partie, la partie en cours marquée.
 *
 * La prune marque la partie en cours (`aria-current="location"`, fond `--gl-plum-soft`) : c'est
 * l'élément courant, au même titre que l'onglet courant d'une barre. Le focus clavier est l'anneau
 * lagon global (`:focus-visible`), rien de plus.
 *
 * **Deux dispositions.** À partir de 75 rem le menu est `sticky` sous la barre du haut, liste
 * toujours visible, bouton masqué. En dessous, il se réduit au bouton `Sections`, `fixed` en bas à
 * droite, qui ouvre la liste juste au-dessus de lui. La liste est cachée par `display: none` et non
 * par un simple décalage : fermée, ses liens ne doivent pas être tabulables.
 *
 * **Fermeture.** Échap ferme la liste ; si le focus était dans le menu, il revient au bouton
 * (sinon il se perdrait avec la liste masquée) ; s'il était ailleurs, on n'y touche pas. Suivre un
 * lien ferme aussi la liste, la page défilant déjà vers la partie. L'écouteur d'Échap est posé sur
 * le document tant que la liste est ouverte, pas sur le menu : Safari ne donne pas le focus à un
 * bouton cliqué, et Échap resterait alors sans effet.
 *
 * Une partie verrouillée reste un lien — sa section existe et explique ce qui manque — marqué d'un
 * cadenas, avec `, not in your plan` en texte masqué. Le nom accessible est aussi posé en
 * `aria-label` (« Signature score, not in your plan »), qui commence par le libellé visible : le
 * calcul d'un nom depuis le contenu (celui de Testing Library compris) glisse une espace devant un
 * élément enfant, « Signature score , not in your plan », et le nom ne doit pas dépendre du moteur
 * qui le calcule. Le numéro d'une question est décoratif (`aria-hidden`) : le nom du lien est le
 * libellé seul.
 */
export default function ReadingMenu({ active, locked, hrefFor }: ReadingMenuProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const focusInside = navRef.current?.contains(document.activeElement) ?? false;
      setOpen(false);
      if (focusInside) toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const renderPart = ({ id, label, number }: ReadingPartInfo) => {
    const current = id === active;
    const isLocked = locked[id] === true;
    const nested = childrenOf(id);
    return (
      <li key={id}>
        <Link
          href={hrefFor(id)}
          aria-current={current ? 'location' : undefined}
          aria-label={isLocked ? `${label}, ${NOT_IN_PLAN}` : undefined}
          onClick={close}
          className={cn(
            LINK,
            current
              ? 'bg-plum-soft font-semibold text-plum'
              : cn('hover:bg-surface-2 hover:text-primary', isLocked ? 'text-muted' : 'text-secondary'),
          )}
        >
          {number !== undefined && (
            <span aria-hidden className="w-3 shrink-0 text-center font-mono text-micro tabular-nums">
              {number}
            </span>
          )}
          <span>
            {label}
            {isLocked && <span className="sr-only">, {NOT_IN_PLAN}</span>}
          </span>
          {isLocked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden />}
        </Link>
        {nested.length > 0 && <ul className="mt-1 space-y-1 pl-5">{nested.map(renderPart)}</ul>}
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label="Parts of this result"
      className={cn(
        // Sous 75 rem : fixé en bas à droite, la liste s'ouvre vers le haut. Au-dessus, collé sous la
        // barre (--sticky-top) avec la marge d'une ligne ; `bottom` et `right` sont remis à auto,
        // sans quoi le `bottom-4` du mobile deviendrait une contrainte du collage. z-30 : sous la
        // barre du haut (z-40), au niveau des bandeaux collés, au-dessus du contenu.
        'fixed bottom-4 right-4 z-30',
        'min-[75rem]:sticky min-[75rem]:bottom-auto min-[75rem]:right-auto',
        'min-[75rem]:top-[calc(var(--sticky-top)+1rem)]',
      )}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-body-sm font-medium text-primary shadow-elev-2 hover:bg-surface-2 min-[75rem]:hidden"
      >
        <List className="h-4 w-4 shrink-0" aria-hidden />
        Sections
      </button>

      <ul
        id={listId}
        className={cn(
          'space-y-1 rounded-card border border-line bg-surface p-1.5 shadow-elev-2',
          // Sous 75 rem : un panneau au-dessus du bouton, qui défile s'il dépasse l'écran.
          'absolute bottom-full right-0 mb-2 max-h-[70vh] w-60 overflow-y-auto',
          open ? 'block' : 'hidden',
          // Dès 75 rem : la liste nue, dans le flux, toujours là.
          'min-[75rem]:static min-[75rem]:mb-0 min-[75rem]:block min-[75rem]:max-h-none min-[75rem]:w-auto',
          'min-[75rem]:overflow-visible min-[75rem]:border-0 min-[75rem]:bg-transparent min-[75rem]:p-0 min-[75rem]:shadow-none',
        )}
      >
        {TOP_LEVEL.map(renderPart)}
      </ul>
    </nav>
  );
}
