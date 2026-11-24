'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { OverflowMenu, type MenuItem } from '@/components/ui/menu';
import { useSetBreadcrumb } from '@/contexts/BreadcrumbContext';
import type { Crumb } from '@/lib/navigation/breadcrumbs';

/**
 * En-tete de page.
 *
 * Les ecrans construisaient chacun le leur : `.page-title` ici, un
 * `font-display text-sm font-semibold` + style inline la, un `gl-card p-5`
 * ailleurs. Trois idiomes de titre pour une seule notion.
 *
 * Il rend un vrai `<header>` (role `banner`), sans bordure ni carte, pose
 * directement sur le fond de page : c'est le geste qui distingue une interface
 * dessinee d'un empilement de boites.
 */

/**
 * Une action VISIBLE de l'en-tete.
 *
 * `menuItem` est son repli : si l'appelant en fournit plus de deux, les
 * suivantes se replient dans le menu — et celles qui n'ont pas de repli sont
 * simplement abandonnees plutot que rendues en troisieme bouton.
 */
export interface PageAction {
  node: React.ReactNode;
  menuItem?: MenuItem;
}

export interface PageHeaderProps {
  title: string;
  /**
   * `label` — un intitule choisi par le produit (« Power Analysis »), rendu
   * grand et serre.
   * `name` — un nom saisi par l'utilisateur ou genere. Rendu un cran plus bas :
   * `Treated_D14_vs_Control_D14_female` a 30px/700 ne se lit pas comme un
   * titre, il se lit comme une erreur.
   */
  titleVariant?: 'label' | 'name';
  /** Sur-titre discret, en casse de phrase. */
  eyebrow?: string;
  description?: React.ReactNode;
  /** Ligne de metadonnees sous le titre (dates, compteurs, statut). */
  meta?: React.ReactNode;
  /** Actions visibles. Au plus DEUX ; les suivantes se replient si elles
   *  fournissent un `menuItem`. */
  actions?: PageAction[];
  /**
   * Outils qui vivent TOUJOURS dans le menu de depassement.
   *
   * Distinct d'`actions` a dessein : une premiere version ne prenait qu'un
   * tableau et gardait les deux premieres entrees comme visibles, si bien
   * qu'un outil place en tete devenait un bouton vide. Ce sont deux notions
   * differentes — ce qu'on propose, et ce qu'on range.
   */
  menuItems?: MenuItem[];
  /** Onglets de section, sous l'en-tete. */
  tabs?: React.ReactNode;
  /**
   * Enrichit le fil d'Ariane (premiere ligne du contenu) avec le vrai nom de
   * l'objet — « Skin Study » plutot que « Project ». Sans lui, le fil
   * retombe sur la table de routes, qui reste correcte.
   */
  crumbs?: Crumb[];
  className?: string;
}

export function PageHeader({
  title,
  titleVariant = 'label',
  eyebrow,
  description,
  meta,
  actions = [],
  menuItems = [],
  tabs,
  crumbs,
  className,
}: PageHeaderProps) {
  useSetBreadcrumb(crumbs ?? null);

  // La regle « au plus deux actions visibles » est tenue PAR CONSTRUCTION et
  // non par revue : un en-tete qui aligne sept boutons de meme poids n'a pas de
  // hierarchie, donc pas de point d'entree.
  const visible = actions.slice(0, 2);
  const overflow: MenuItem[] = [
    ...actions.slice(2).map((a) => a.menuItem).filter((i): i is MenuItem => Boolean(i)),
    ...menuItems,
  ];

  return (
    <header className={cn('mb-8', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}

          {/* `min-w-0 break-words` : un nom de comparaison tient jusqu'a 255
              caracteres, parfois sans un espace. Sans cela le <h1> garde sa
              largeur minimale de contenu et pousse la page hors d'un ecran de
              375px. `break-words` coupe un mot seulement quand il ne tient pas ;
              l'ancien `break-all` coupait aussi un titre a espaces au milieu d'un
              mot, en bout de ligne. */}
          <h1
            title={title}
            className={cn(
              'line-clamp-2 min-w-0 break-words font-display text-primary',
              titleVariant === 'name' ? 'text-heading' : 'text-display',
            )}
          >
            {title}
          </h1>

          {description && (
            // 68ch : au-dela, l'oeil perd la ligne en revenant a la gauche.
            <p className="mt-2 max-w-[68ch] text-body-sm text-secondary">{description}</p>
          )}

          {meta && <div className="mt-4 flex flex-wrap items-center gap-3">{meta}</div>}
        </div>

        {(visible.length > 0 || overflow.length > 0) && (
          <div className="flex shrink-0 items-center gap-2">
            {visible.map((action, i) => (
              <React.Fragment key={i}>{action.node}</React.Fragment>
            ))}
            {overflow.length > 0 && <OverflowMenu items={overflow} />}
          </div>
        )}
      </div>

      {tabs && <div className="mt-6">{tabs}</div>}
    </header>
  );
}
