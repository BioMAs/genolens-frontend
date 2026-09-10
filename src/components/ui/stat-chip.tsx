import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Pastille de metrique.
 *
 * Le ton est SEMANTIQUE, jamais decoratif. Une pastille qui n'exprime rien de
 * particulier reste neutre : c'est le cas de la grande majorite d'entre elles
 * (nombre de datasets, de fichiers, d'analyses). Alterner les teintes pour
 * « egayer » une rangee produit une salade de fruits qui brouille le seul
 * signal utile — ou la couleur, la, veut dire quelque chose.
 *
 * `up` / `down` sont l'alias chrome de la direction de regulation ; ils
 * resolvent sur les memes teintes que utils/chartPalettes.ts, qui fait
 * autorite. La version precedente mappait « down » sur le violet via un
 * `tone="purple"`, ce qui contredisait le rouge des graphiques.
 */
export type StatChipTone =
  | 'neutral'
  | 'accent'
  | 'up'
  | 'down'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ai';

interface StatChipProps {
  icon?: React.ReactNode;
  value: number | string;
  label: string;
  tone?: StatChipTone;
  className?: string;
  style?: React.CSSProperties;
}

/** Fond de la pastille et couleur de son icone, par ton. */
const TONES: Record<StatChipTone, { chip: string; icon: string }> = {
  neutral: { chip: 'bg-surface-2', icon: 'text-muted' },
  accent: { chip: 'bg-accent-soft', icon: 'text-accent' },
  up: { chip: 'bg-success-soft', icon: 'text-up' },
  down: { chip: 'bg-danger-soft', icon: 'text-down' },
  success: { chip: 'bg-success-soft', icon: 'text-success' },
  warning: { chip: 'bg-warning-soft', icon: 'text-warning' },
  danger: { chip: 'bg-danger-soft', icon: 'text-danger' },
  ai: { chip: 'bg-ai-soft', icon: 'text-ai' },
};

export function StatChip({
  icon,
  value,
  label,
  tone = 'neutral',
  className,
  style,
}: StatChipProps) {
  const { chip, icon: iconColor } = TONES[tone];
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-control px-3 py-2 text-body-sm',
        chip,
        className,
      )}
      style={style}
    >
      {icon && <span className={iconColor}>{icon}</span>}
      {/* tabular-nums : sans cela une valeur qui change de chiffre fait
          respirer la pastille et decale ses voisines dans la rangee. */}
      <span className="font-semibold tabular-nums text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
