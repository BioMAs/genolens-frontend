'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Controle segmente — l'unique idiome de bascule de l'application.
 *
 * Le code en portait huit coexistants : pastilles dans un conteneur borde,
 * segmente a etat plein, segmente a etat blanc, onglets soulignes, cartes
 * numerotees, puces d'ancre… Chacun etait defendable seul ; ensemble ils
 * donnaient a chaque ecran l'air d'avoir ete dessine par quelqu'un d'autre.
 *
 * Ce fichier contenait auparavant des onglets SOULIGNES. L'idiome retenu est
 * le segmente, deja en place sur le commutateur d'ecran d'une comparaison et
 * sur la bascule ORA/GSEA — donc c'est celui-la qui devient la primitive, et
 * l'implementation soulignee qui disparait.
 *
 * L'etat actif porte l'accent interactif : c'est ce qu'on vient de choisir.
 *
 * Des boutons avec `aria-current`, et non le motif ARIA tablist/tab. Ce motif
 * promet au lecteur d'ecran une relation onglet -> panneau (aria-controls,
 * role="tabpanel") que ces trois usages ne cablent pas : le contenu vit
 * ailleurs dans l'arbre et change de forme selon l'ecran. Un motif d'onglets
 * incomplet renseigne plus mal qu'un groupe de boutons honnete.
 */
export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Rendu desactive, avec un cadenas et `lockedHint` en infobulle. */
  locked?: boolean;
  lockedHint?: string;
  /**
   * Detail annonce aux lecteurs d'ecran mais non peint.
   *
   * Un controle compact n'a pas la place d'un decompte ou d'une description ;
   * pour un lecteur d'ecran cet espace ne coute rien, et l'information reste
   * utile.
   */
  srOnly?: string;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Le controle occupe-t-il toute la largeur, ses segments a parts egales ? */
  stretch?: boolean;
  /** Nom accessible du groupe. */
  label?: string;
  className?: string;
  /** Gabarit de l'etiquette accessible de chaque segment, ex. `Open ${label}`. */
  itemLabel?: (item: SegmentItem<T>) => string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  stretch = false,
  label,
  className,
  itemLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex gap-1 rounded-card border border-line bg-surface-2 p-1',
        stretch && 'flex w-full',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        const common = cn(
          'flex items-center justify-center gap-2 rounded-control px-3 py-2',
          'text-body-sm font-semibold transition-colors',
          stretch && 'min-w-0 flex-1',
        );

        if (item.locked) {
          return (
            <span
              key={item.value}
              aria-disabled
              title={item.lockedHint}
              className={cn(common, 'cursor-not-allowed text-muted opacity-60')}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </span>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-label={itemLabel?.(item)}
            onClick={() => onValueChange(item.value)}
            className={cn(
              common,
              'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
              isActive
                ? 'bg-accent text-on-accent'
                : 'text-secondary hover:bg-hover hover:text-primary',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.srOnly && <span className="sr-only"> — {item.srOnly}</span>}
          </button>
        );
      })}
    </div>
  );
}
