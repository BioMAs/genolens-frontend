'use client';

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FocusKind } from './readingRoutes';

/** Le texte masqué d'un outil que le plan n'inclut pas, le même que celui du menu. */
const NOT_IN_PLAN = 'not in your plan';

export interface ChapterTool {
  /** Le libellé du bouton. */
  label: string;
  /** La vue agrandie qu'il ouvre. */
  focus: FocusKind;
  /**
   * Le plan n'inclut pas l'outil : un cadenas, et `, not in your plan` en texte masqué. Le bouton
   * ouvre quand même la vue, qui montre le bloc verrouillé et le moyen de demander l'accès.
   */
  locked?: boolean;
}

interface ChapterToolsProps {
  /** Le nom du groupe, pour les lecteurs d'écran (« More views of the counts »). */
  label: string;
  tools: ReadonlyArray<ChapterTool>;
  onOpenFocus: (kind: FocusKind) => void;
}

/**
 * Les autres vues d'un chapitre : une rangée discrète de boutons sous sa figure.
 *
 * Le chapitre garde une seule action marquée, à droite de son titre ; ses autres outils (heatmap,
 * statistiques des méthodes, réseau, GSEA…) restent visibles ici, en boutons `ghost`, pour
 * qu'aucun outil de l'ancienne page ne soit joignable par l'URL seule.
 *
 * Un outil verrouillé porte le nom accessible du menu, posé aussi en `aria-label` pour la même
 * raison que dans `ReadingMenu` : le nom ne doit pas dépendre du moteur qui le calcule.
 */
export default function ChapterTools({ label, tools, onOpenFocus }: ChapterToolsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {tools.map((tool) => (
        <Button
          key={tool.focus}
          variant="ghost"
          size="sm"
          aria-label={tool.locked ? `${tool.label}, ${NOT_IN_PLAN}` : undefined}
          onClick={() => onOpenFocus(tool.focus)}
        >
          {tool.locked && <Lock className="h-3.5 w-3.5" aria-hidden />}
          <span>
            {tool.label}
            {tool.locked && <span className="sr-only">, {NOT_IN_PLAN}</span>}
          </span>
        </Button>
      ))}
    </div>
  );
}
