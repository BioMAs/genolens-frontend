'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ChartState = 'ready' | 'loading' | 'empty' | 'error';

interface Props {
  /** Titre de la carte. Devient le `<figcaption>` du graphique. */
  title: ReactNode;
  /** Precision d'une ligne : unite, filtre applique, nombre d'elements. */
  subtitle?: ReactNode;
  /** Barre d'outils : assistant IA, bascule daltonisme, export. */
  actions?: ReactNode;
  state?: ChartState;
  /**
   * Place RESERVEE a la zone de trace, en pixels, dans les quatre etats.
   *
   * Appliquee en `min-height` et non en `height` : une carte porte parfois du
   * mobilier au-dessus du trace — la lecture en clair de la PCA, une legende,
   * un bandeau de seuils — et une hauteur fixe le rognerait. Reserver un
   * MINIMUM supprime le saut sans risquer de couper.
   *
   * C'est la raison d'etre du composant. Les traitements qu'il remplace
   * rendaient `h-48`, `h-64`, `260px` ou `min-h-[400px]` selon l'etat et le
   * fichier, et deux d'entre eux rendaient HORS de la carte : le cadre
   * disparaissait puis revenait, et tout ce qui suivait sautait a l'arrivee des
   * donnees. Reserver la place est la seule facon de ne pas deplacer ce que
   * l'utilisateur est en train de lire.
   *
   * `'auto'` pour les rares graphiques qui calculent leur propre hauteur a
   * partir du nombre de lignes — ils acceptent le saut en connaissance de cause.
   */
  minHeight: number | 'auto';
  /** Message d'erreur. Affiche seulement quand `state === 'error'`. */
  error?: ReactNode;
  /** Message d'etat vide. Affiche seulement quand `state === 'empty'`. */
  empty?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * L'enveloppe commune des graphiques.
 *
 * Quatre traitements de chargement sans rapport coexistaient — un spinner dans
 * une carte, deux textes nus hors carte, et des barres de squelette — chacun
 * avec sa hauteur, sa couleur d'erreur et sa formulation. Le resultat n'etait
 * pas seulement incoherent : il etait instable, parce que chaque etat occupait
 * une place differente.
 *
 * Rendu en `<figure>` / `<figcaption>` : un graphique EST une figure, et son
 * titre en est la legende. Les technologies d'assistance le lisent alors comme
 * un tout nomme, au lieu d'un titre puis d'un bloc anonyme.
 */
export default function ChartCard({
  title,
  subtitle,
  actions,
  state = 'ready',
  minHeight,
  error,
  empty,
  className,
  children,
}: Props) {
  const bodyStyle = minHeight === 'auto' ? undefined : { minHeight };

  return (
    <figure
      className={cn('gl-card p-4', className)}
      // Annonce le chargement sans voler le focus ni vider la region.
      aria-busy={state === 'loading' || undefined}
    >
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title text-primary">{title}</h3>
          {subtitle ? <p className="mt-1 text-caption text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </figcaption>

      <div style={bodyStyle} className={minHeight === 'auto' ? undefined : 'relative'}>
        {state === 'ready' ? children : null}

        {state === 'loading' ? (
          // Un squelette plutot qu'un spinner : il occupe la forme de ce qui
          // arrive, donc l'oeil n'a pas a se replacer une fois les donnees la.
          <div className="flex h-full w-full flex-col justify-end gap-2" aria-hidden>
            {[62, 88, 45, 74, 96, 58].map((w, i) => (
              <div
                key={w}
                className="skeleton w-full"
                style={{ height: `${8 + (i % 3) * 4}%`, maxWidth: `${w}%` }}
              />
            ))}
          </div>
        ) : null}

        {state === 'empty' ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-body-sm text-muted">
            {empty ?? 'No data to plot.'}
          </div>
        ) : null}

        {state === 'error' ? (
          <div
            role="alert"
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <AlertTriangle className="h-5 w-5 text-danger-ink" aria-hidden />
            <p className="text-body-sm text-danger-ink">{error ?? 'This chart could not be loaded.'}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
