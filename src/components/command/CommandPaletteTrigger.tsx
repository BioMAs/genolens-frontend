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
 */
export default function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Open the command palette"
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-9 w-full items-center gap-2 rounded-control bg-surface-2 px-3 text-caption text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">Search…</span>
      <KbdHint>⌘K</KbdHint>
    </button>
  );
}
