import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Enveloppe de page.
 *
 * Quatre enveloppes coexistaient : `.page-container` (9 fichiers, 1380px),
 * `mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8` (13 fichiers, 1280px), nue, et
 * un `min-h-screen` + fond secondaire (21 sites). Cette derniere etait un BUG de theme
 * sombre — `--surface-secondary` vaut #171e2c quand `--app-bg` vaut #0c1018,
 * donc ces routes avaient un fond visiblement plus clair que le dashboard — et
 * forcait en plus un 100vh a l'interieur de `.app-content`, qui defile deja.
 *
 * La mesure depend du REGIME et non du fichier :
 *   - `prose`   760px  — texte suivi : guides, reponses de l'IA
 *   - `default` 1200px — la plupart des ecrans
 *   - `wide`    1600px — ecrans de donnees : tableaux de genes, comparaisons
 *
 * Le padding vient des tokens `--page-*`, donc une seule media query les fait
 * bouger ensemble.
 */
export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  measure?: 'prose' | 'default' | 'wide';
}

export function PageShell({ measure = 'default', className, ...props }: PageShellProps) {
  return (
    <div
      // `default` ne pose pas l'attribut : c'est la regle de base du selecteur.
      data-measure={measure === 'default' ? undefined : measure}
      className={cn('page-container', className)}
      {...props}
    />
  );
}
