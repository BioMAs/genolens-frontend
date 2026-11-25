'use client';

import { Search } from 'lucide-react';
import { KbdHint } from '@/components/ui/kbd-hint';
import { openCommandPalette } from './commandPaletteStore';

/**
 * La pastille de la barre superieure.
 *
 * Elle remplace un champ de saisie reellement editable. Ce n'est pas une
 * economie de place mais une correction de sens : le champ ne cherchait QUE des
 * genes, alors que sa forme promettait une recherche globale — donc taper un
 * nom de projet dedans ne rendait jamais rien, sans dire pourquoi. Une pastille
 * annonce qu'elle ouvre autre chose.
 *
 * Son libelle dit ce qu'on y TROUVE : les trois choses que la palette sait
 * retrouver. Le texte visible EST le nom accessible (WCAG 2.5.3, etiquette dans
 * le nom) — l'ancien « Open the command palette » disait ce que fait le bouton
 * mais pas ce qu'on y cherche, et ne reprenait pas un mot du texte affiche.
 */
const TRIGGER_LABEL = 'Search genes, projects, comparisons';

export default function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label={TRIGGER_LABEL}
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-9 w-full items-center gap-2 rounded-control bg-surface-2 px-3 text-caption text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">{TRIGGER_LABEL}</span>
      {/* Un raccourci clavier n'a pas de sens sur ecran tactile, et il prendrait
          la place du texte de la pastille sous 40rem. */}
      <KbdHint className="hidden sm:inline-block">⌘K</KbdHint>
    </button>
  );
}
