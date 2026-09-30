'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CornerDownLeft,
  Dna,
  FolderKanban,
  Minus,
  Search,
  Settings2,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useGeneSearch } from '@/hooks/useGeneSearch';
import { useTheme } from '@/contexts/ThemeContext';
import { useChartPrefs, toggleColorblind } from '@/contexts/chartPrefs';
import { useTour } from '@/contexts/TourContext';
import {
  buildCommands,
  buildGeneCommands,
  filterCommands,
  flattenCommands,
  type Command,
  type CommandGroup,
  type GeneDirection,
} from '@/lib/commands';
import { closeCommandPalette, useCommandPaletteOpen, toggleCommandPalette } from './commandPaletteStore';
import { cn } from '@/lib/cn';

/**
 * La palette de commandes.
 *
 * Elle remplace une zone de recherche de 400px — ramenee a 240 en vague 1 — qui
 * occupait de la chrome permanente pour une fonction occasionnelle, et qui ne
 * savait chercher qu'UNE chose : des genes. La palette absorbe la recherche de
 * gene, le saut de projet, le saut de route, la bascule de theme, celle de
 * palette sure et la reprise de visite guidee.
 *
 * Le clavier parcourt la liste A PLAT, dans l'ordre d'affichage. C'est le
 * detail qui separe une palette utilisable d'une demonstration : un curseur qui
 * saute de groupe en groupe oblige a regarder l'ecran, donc annule ce que le
 * clavier apportait.
 */
/**
 * L'enveloppe ne porte QUE le raccourci global. Le dialogue est un composant
 * distinct, monte uniquement quand la palette est ouverte : son etat nait donc
 * a chaque ouverture, ce qui supprime les deux effets qui le remettaient a zero
 * a la main — et avec eux la cascade de rendus qu'ils declenchaient.
 */
export default function CommandPalette() {
  const open = useCommandPaletteOpen();

  // Raccourci GLOBAL : monte une fois, avec la palette, plutot que sur chaque
  // ecran. `preventDefault` retire ⌘K au navigateur, qui y met sa barre d'URL.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return open ? <CommandPaletteDialog /> : null;
}

function CommandPaletteDialog() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { theme, toggleTheme } = useTheme();
  const { colorblind } = useChartPrefs();
  const { restartCurrentTour, currentTourId } = useTour();
  // Le dialogue n'existe que pendant l'ouverture : la liste des projets ne part
  // donc jamais sur un ecran ou la palette est fermee. C'est une fonction
  // occasionnelle, elle ne doit pas couter une requete a chaque page.
  const { data: projectsData } = useProjects({}, true);

  const trimmed = query.trim();
  const geneSearchActive = trimmed.length >= GENE_QUERY_MIN_LENGTH;
  // Une requete par PAUSE de frappe, pas par touche : « ENSG00000141510 » tape
  // d'un trait en coutait quinze, dont les premieres (« EN », « ENS ») sont les
  // plus cheres puisqu'elles correspondent a presque toute la table.
  const geneQuery = useDebouncedValue(trimmed, GENE_SEARCH_DEBOUNCE_MS);
  const {
    data: geneData,
    isError: geneError,
  } = useGeneSearch({
    query: geneQuery,
    limit: GENE_RESULT_LIMIT,
    enabled: geneSearchActive && geneQuery.length >= GENE_QUERY_MIN_LENGTH,
  });
  // Des resultats ne s'affichent que pour la requete a l'ecran : ceux de « TP5 »
  // sous « TP53X » presenteraient des genes qui ne correspondent pas.
  const geneHits = geneSearchActive && geneData?.query === trimmed ? geneData.results : null;
  const geneStatus: GeneStatus = !geneSearchActive
    ? 'idle'
    : geneHits
      ? geneHits.length
        ? 'results'
        : 'empty'
      : geneError && geneQuery === trimmed
        ? 'error'
        : 'searching';

  const groups = useMemo<CommandGroup[]>(() => {
    const base = buildCommands({
      projects: (projectsData?.items ?? []).map((p) => ({ id: p.id, name: p.name })),
      actions: {
        theme,
        toggleTheme,
        colorblind,
        toggleColorblind,
        restartTour: currentTourId ? restartCurrentTour : undefined,
      },
    });
    const filtered = filterCommands(base, query);

    if (!geneHits?.length) return filtered;

    // Les genes passent EN TETE quand il y en a : taper un symbole est le seul
    // cas ou l'utilisateur sait deja exactement ce qu'il veut.
    return [{ heading: 'Genes', items: buildGeneCommands(geneHits) }, ...filtered];
  }, [
    projectsData, theme, toggleTheme, colorblind, currentTourId, restartCurrentTour,
    query, geneHits,
  ]);

  const flat = useMemo(() => flattenCommands(groups), [groups]);

  // L'element qui avait le focus est rendu a la fermeture : sans cela, fermer
  // la palette au clavier renvoie le focus en haut du document, et il faut
  // re-parcourir la page pour revenir ou l'on etait.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => returnTo?.focus?.();
  }, []);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      closeCommandPalette();
      if (command.href) router.push(command.href);
      else command.run?.();
    },
    [router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCommandPalette();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!flat.length) return;
      // Le parcours boucle : arriver au bout d'une liste sans pouvoir revenir
      // au debut oblige a remonter touche par touche.
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (cursor + step + flat.length) % flat.length;
      setCursor(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      run(flat[cursor]);
      return;
    }
    if (event.key === 'Tab') {
      // Piege de focus. Sans lui, Tab sort de la boite et parcourt la page
      // DERRIERE le voile : au lecteur d'ecran, la modale n'en est pas une.
      const focusables = event.currentTarget.querySelectorAll<HTMLElement>(
        'input, button:not([disabled])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const ICONS: Record<Command['kind'], React.ReactNode> = {
    navigate: <ArrowRight className="h-4 w-4" aria-hidden />,
    project: <FolderKanban className="h-4 w-4" aria-hidden />,
    gene: <Dna className="h-4 w-4" aria-hidden />,
    action: <Settings2 className="h-4 w-4" aria-hidden />,
  };

  let index = -1;

  return (
    <div
      /* z-10000 et non z-100 : le bandeau de licence monte a z-9999, et une
         modale recouverte par une banniere n'est plus une modale. Il n'existe
         pas d'echelle de z-index dans le produit — c'est une dette, et cette
         valeur la rend visible plutot que de la repartir. */
      className="fixed inset-0 z-[10000] flex items-start justify-center p-4 pt-[12vh]"
      role="presentation"
    >
      {/* Le voile porte LUI-MEME la fermeture : place sur le conteneur, le
          `e.target === e.currentTarget` ne se declenchait jamais, puisque c'est
          le voile qu'on touche, pas le conteneur qu'il recouvre. */}
      <div
        className="absolute inset-0 bg-[rgb(0_0_0/.45)]"
        aria-hidden
        onMouseDown={closeCommandPalette}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-card bg-raised shadow-elev-2"
      >
        <div className="flex items-center gap-3 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Le curseur revient en tete a la frappe, ici et non dans un
              // effet : garder sa position ferait executer une commande que
              // l'utilisateur ne regarde plus.
              setCursor(0);
            }}
            placeholder="Search genes, projects, screens and settings…"
            aria-label="Search commands"
            aria-controls="command-palette-list"
            className="h-11 w-full bg-transparent text-body text-primary placeholder:text-muted focus:outline-none"
          />
        </div>

        <div
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-[52vh] overflow-y-auto border-t border-subtle py-2"
        >
          {geneStatus !== 'idle' && geneStatus !== 'results' && (
            // Hors de la liste parcourue au clavier : un message n'est pas une
            // commande, Entree ne doit pas pouvoir l'« executer ».
            <div className="mb-2">
              <p className="eyebrow px-4 py-1">Genes</p>
              <p role="status" className="px-4 py-2 text-body-sm text-muted">
                {geneStatus === 'searching' && 'Searching genes…'}
                {geneStatus === 'empty' && <>No gene matches “{trimmed}”.</>}
                {geneStatus === 'error' && 'Gene search is unavailable right now.'}
              </p>
            </div>
          )}
          {flat.length === 0 ? (
            // Le message des genes suffit quand il est la : « Nothing matches »
            // en dessous le repeterait.
            geneStatus === 'idle' && (
              <p className="px-4 py-8 text-center text-body-sm text-muted">
                Nothing matches “{trimmed}”.
              </p>
            )
          ) : (
            groups.map((group) => (
              <div key={group.heading} className="mb-2 last:mb-0">
                <p className="eyebrow px-4 py-1">{group.heading}</p>
                {group.items.map((item) => {
                  index += 1;
                  const active = index === cursor;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={index}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => setCursor(flat.indexOf(item))}
                      onClick={() => run(item)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                        active ? 'bg-accent-soft text-accent-ink' : 'text-primary hover:bg-hover',
                      )}
                    >
                      <span className={active ? 'text-accent-ink' : 'text-muted'}>
                        {ICONS[item.kind]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body-sm">{item.label}</span>
                      {item.direction && <Direction direction={item.direction} />}
                      {item.hint && (
                        <span className="shrink-0 truncate text-caption text-muted">{item.hint}</span>
                      )}
                      {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Le backend refuse une requete d'un seul caractere ; inutile de la lui envoyer. */
const GENE_QUERY_MIN_LENGTH = 2;
/** Autant de lignes que la palette en montre sans defiler. */
const GENE_RESULT_LIMIT = 6;
const GENE_SEARCH_DEBOUNCE_MS = 200;

type GeneStatus = 'idle' | 'searching' | 'results' | 'empty' | 'error';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const DIRECTIONS: Record<GeneDirection, { label: string; icon: React.ReactNode; tone: string }> = {
  up: { label: 'Up', icon: <ArrowUp className="h-3 w-3" aria-hidden />, tone: 'text-up' },
  down: { label: 'Down', icon: <ArrowDown className="h-3 w-3" aria-hidden />, tone: 'text-down' },
  ns: { label: 'NS', icon: <Minus className="h-3 w-3" aria-hidden />, tone: 'text-muted' },
};

/**
 * Le sens de variation, en MOT et en fleche : la couleur seule ne se lit ni par
 * un daltonien ni par un lecteur d'ecran.
 */
function Direction({ direction }: { direction: GeneDirection }) {
  const { label, icon, tone } = DIRECTIONS[direction];
  return (
    <span
      data-direction={direction}
      className={cn('inline-flex shrink-0 items-center gap-1 text-caption font-semibold', tone)}
    >
      {icon}
      {label}
    </span>
  );
}
