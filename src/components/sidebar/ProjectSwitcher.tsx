'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronsUpDown, Check } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Dot } from '@/components/ui/dot';
import { cn } from '@/lib/cn';

/**
 * Selecteur de projet.
 *
 * Le groupe « Project » de la sidebar etait annonce par un libelle contenant
 * lui-meme un span avec une puce et le nom du projet — un libelle dans un
 * libelle — et le seul moyen de changer de projet etait de remonter a
 * /projects. C'est le changement d'arborescence qui ameliore reellement la
 * journee : on passe d'un projet a l'autre sans quitter l'ecran ou l'on est.
 *
 * La requete est partagee avec /projects et le dashboard via React Query, donc
 * elle ne coute rien de plus ici.
 */
export default function ProjectSwitcher({
  projectId,
  projectLabel,
}: {
  projectId: string;
  projectLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  // La liste n'est demandee qu'a l'ouverture : la sidebar est montee sur chaque
  // page, un fetch systematique serait un cout permanent pour une action rare.
  const { data } = useProjects(
    { page_size: 8, sort_by: 'updated_at', sort_order: 'desc' },
    open,
  );
  const projects = data?.items ?? [];

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

  return (
    <div ref={root} className="relative mx-2">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full cursor-pointer items-center gap-2 rounded-control px-3 text-left',
          'transition-colors hover:bg-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <Dot variant="ready" size={7} />
        <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-primary" title={projectLabel}>
          {projectLabel}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-card bg-raised py-1 shadow-elev-2"
        >
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-caption text-muted">Loading projects…</p>
          ) : (
            projects.map((project) => {
              const current = project.id === projectId;
              return (
                <Link
                  key={project.id}
                  role="menuitem"
                  href={`/projects/${project.id}`}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-primary transition-colors hover:bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate" title={project.name}>
                    {project.name}
                  </span>
                  {current && <Check className="h-3.5 w-3.5 shrink-0 text-accent-ink" aria-hidden />}
                </Link>
              );
            })
          )}
          <Link
            role="menuitem"
            href="/projects"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 border-t border-subtle px-3 py-2 text-caption text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            All projects…
          </Link>
        </div>
      )}
    </div>
  );
}
