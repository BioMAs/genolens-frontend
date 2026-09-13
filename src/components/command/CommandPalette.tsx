'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CornerDownLeft, Dna, FolderKanban, Search, Settings2 } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useGeneSearch } from '@/hooks/useGeneSearch';
import { useTheme } from '@/contexts/ThemeContext';
import { useChartPrefs, toggleColorblind } from '@/contexts/chartPrefs';
import { useTour } from '@/contexts/TourContext';
import {
  buildCommands,
  filterCommands,
  flattenCommands,
  type Command,
  type CommandGroup,
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
  const { data: geneData } = useGeneSearch({
    query: trimmed,
    enabled: trimmed.length >= 2,
  });

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

    const genes = geneData?.results ?? [];
    if (!genes.length) return filtered;

    // Les genes passent EN TETE quand il y en a : taper un symbole est le seul
    // cas ou l'utilisateur sait deja exactement ce qu'il veut.
    return [
      {
        heading: 'Genes',
        items: genes.slice(0, 6).map<Command>((g, i) => ({
          id: `gene:${g.project_id}:${g.dataset_id}:${g.gene_symbol}:${i}`,
          label: g.gene_symbol,
          hint: `${g.project_name} · ${g.dataset_name}`,
          kind: 'gene',
          href: `/projects/${g.project_id}/datasets/${g.dataset_id}?gene=${encodeURIComponent(g.gene_symbol)}`,
        })),
      },
      ...filtered,
    ];
  }, [
    projectsData, theme, toggleTheme, colorblind, currentTourId, restartCurrentTour,
    query, geneData,
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
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-muted">
              Nothing matches “{trimmed}”.
            </p>
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
