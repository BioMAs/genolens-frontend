import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ai'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Badge — etiquette de statut, categorie ou metadonnee.
 *
 * Les variantes passent par des classes et non par un objet `style`. La
 * version precedente fusionnait `{...variants[variant], ...style}` en inline :
 * un consommateur ne pouvait donc rien surcharger, et surtout la primitive ne
 * pouvait exprimer ni `hover:` ni `dark:` — un style inline n'a pas d'etats.
 *
 * Le neutre est le defaut. Un badge colore doit signifier quelque chose ;
 * s'il ne fait que decorer une metadonnee, il reste neutre.
 */
const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-surface-2 text-secondary',
  accent: 'border-accent-ring bg-accent-soft text-accent-ink',
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  danger: 'border-danger/25 bg-danger-soft text-danger',
  ai: 'border-ai/25 bg-ai-soft text-ai',
  outline: 'border-line bg-transparent text-primary',
};

function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
        'text-micro transition-colors',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
