'use client';

import { useId, type ReactNode } from 'react';
import { partDomId, type ReadingPart } from './readingRoutes';

interface ReadingChapterProps {
  /** La partie de la lecture : elle donne l'id de la section, donc le fragment qui y mène. */
  part: ReadingPart;
  /** Le numéro de la question, tel que la colonne vertébrale le porte. */
  number: 1 | 2 | 3 | 4 | 5;
  /** La question, mot pour mot : c'est le titre du chapitre. */
  title: string;
  /** Le bouton qui ouvre la vue agrandie de la figure, à droite du titre. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * La coque d'un chapitre de la lecture : une question, sa figure, et de quoi l'agrandir.
 *
 * Une `<section>` nommée par son titre (`aria-labelledby`), si bien que les lecteurs d'écran la
 * listent comme une région : `ReadingMenu` et les fragments `#part-<id>` la trouvent par son `id`
 * (`partDomId`). Le titre est un `h2` ; c'est aussi l'un des deux seuls endroits, avec le `h1` de la
 * page, où Newsreader est permise. Le numéro est décoratif (`aria-hidden`) : la colonne vertébrale
 * le porte déjà, et le nom de la région reste la question.
 *
 * Le chapitre ne sait rien de ce qu'il contient ; `scroll-mt` laisse la barre du haut au-dessus du
 * titre quand un lien d'ancre y défile.
 */
export default function ReadingChapter({ part, number, title, action, children }: ReadingChapterProps) {
  const headingId = useId();

  return (
    <section
      id={partDomId(part)}
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--sticky-top)+1rem)] space-y-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span aria-hidden className="w-4 shrink-0 text-center font-mono text-caption tabular-nums text-muted">
            {number}
          </span>
          <h2 id={headingId} className="font-display text-heading text-primary">
            {title}
          </h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
