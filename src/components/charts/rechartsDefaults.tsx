'use client';

import * as React from 'react';
import type { TooltipContentProps } from 'recharts';
import { CHART_VARS } from '@/utils/chartTheme';
import { cn } from '@/lib/cn';

/**
 * Les defauts Recharts, en un seul endroit.
 *
 * Seize fichiers declaraient chacun leur `tick={{…}}` (29 occurrences), leur
 * `<CartesianGrid>` (17) et leur `margin={{}}` (15). La couleur de grille avait
 * SEPT reponses differentes — `var(--border)`, `var(--border-subtle)`,
 * `#f1f5f9`, `#f0f0f0`, `#eee`, une grille nue sans trait, ou pas de grille du
 * tout. Les tailles de graduation en avaient quatre : 10, 10.5, 11, 12.
 *
 * Le defaut le plus visible reste ailleurs : 10 des 22 `<Tooltip>` n'avaient
 * AUCUN `content=` et rendaient donc la boite blanche par defaut de Recharts —
 * texte quasi noir sur fond blanc, illisible en theme sombre.
 *
 * Ce n'est pas 21, contrairement a ce que laissait croire le decompte des
 * `contentStyle` : les 9 autres ont un `content=` personnalise, et ces
 * composants-la sont deja thematises. « Ne fixe pas contentStyle » et « rend la
 * boite par defaut » ne sont pas la meme chose.
 *
 * Tout est derive de `tools/dd/ReportFigures.tsx`, qui avait deja ecrit les
 * bonnes regles dans ses commentaires : la grille n'est jamais au premier plan,
 * un libelle se peint toujours a l'encre du texte et jamais avec la couleur de
 * la donnee qu'il designe.
 */

/** Marge par defaut. Recharts n'en a pas de raisonnable. */
export const CHART_MARGIN = { top: 8, right: 16, bottom: 8, left: 8 } as const;

/** Pour un graphique a axes titres ou a libelles longs. */
export const CHART_MARGIN_LABELLED = { top: 8, right: 32, bottom: 24, left: 48 } as const;

/**
 * Grille : horizontale seulement.
 *
 * Une grille verticale double le nombre de traits sans rien ajouter — on lit
 * une valeur en suivant une horizontale, pas une verticale.
 */
export const CHART_GRID = {
  stroke: CHART_VARS.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/**
 * Axes. 11px correspond au cran `micro` de l'echelle typographique ; l'eventail
 * 10 / 10.5 / 11 / 12 qui circulait ne correspondait a rien.
 *
 * Ni trait d'axe ni graduation : la grille suffit a situer, et deux traits pour
 * une meme fonction alourdissent le trace.
 */
export const CHART_AXIS = {
  tick: { fontSize: 11, fill: CHART_VARS.inkMuted },
  tickLine: false,
  axisLine: false,
} as const;

/** Curseur de survol : un voile, jamais un trait colore. */
export const CHART_TOOLTIP_CURSOR = { fill: CHART_VARS.hover } as const;

/**
 * Animation desactivee par defaut.
 *
 * Sur un nuage de plusieurs milliers de points, l'animation d'entree de
 * Recharts coute plus qu'elle n'apporte, et elle retarde la lecture de la
 * donnee — qui est la seule raison d'etre du graphique.
 */
export const CHART_ANIM = { isAnimationActive: false } as const;

interface ChartTooltipProps extends Partial<TooltipContentProps<number, string>> {
  /** Unite accolee a chaque valeur. */
  unit?: string;
  /** Mise en forme des valeurs. Par defaut : separateur de milliers. */
  format?: (value: number) => string;
  /** Libelle de l'entree survolee. Par defaut : le `label` de Recharts. */
  labelFormatter?: (label: string) => string;
  className?: string;
}

const defaultFormat = (v: number) =>
  Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(2);

/**
 * Le tooltip commun.
 *
 * `tabular-nums` n'est pas cosmetique : sans chiffres de largeur fixe, une
 * valeur qui change en survolant fait respirer la boite et deplace le texte
 * sous le curseur.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  format = defaultFormat,
  labelFormatter,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        'rounded-sm border border-line bg-surface px-2.5 py-2 text-caption shadow-elev-2',
        className,
      )}
    >
      {label != null && label !== '' && (
        <div className="mb-1 font-semibold text-primary">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-secondary">
          {/* La pastille reprend la couleur de la serie ; le LIBELLE reste a
              l'encre du texte. Peindre le libelle avec la couleur de la donnee
              le rend illisible des que la serie est claire. */}
          {entry.color && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: entry.color }}
            />
          )}
          <span className="flex-1">{entry.name}</span>
          <span className="font-semibold tabular-nums text-primary">
            {typeof entry.value === 'number' ? format(entry.value) : String(entry.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Legende : meme encre, meme taille que les graduations. */
export function ChartLegendContent({
  payload,
}: {
  payload?: { value: string; color?: string }[];
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-4 pt-3">
      {payload.map((entry) => (
        <li key={entry.value} className="flex items-center gap-2 text-caption text-secondary">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}
