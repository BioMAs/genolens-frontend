'use client';

import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChartPrefs, toggleColorblind } from '@/contexts/chartPrefs';

/**
 * La bascule de palette sure. Sans props d'etat : la preference est globale et
 * persistee (`@/contexts/chartPrefs`), donc chaque instance lit et ecrit la
 * meme chose. Les six emplacements s'accordent desormais, y compris entre deux
 * ecrans differents et apres un rechargement.
 *
 * L'etat actif portait `text-blue-600 bg-blue-50` colle a `transition-colors`
 * par une concatenation sans espace : les deux classes fusionnaient en un
 * token invalide et etaient toutes deux perdues. Le bouton n'avait donc AUCUN
 * etat actif visible. Corriger le seul espacement aurait rendu visible un bleu
 * hors systeme — la regle est un accent unique, l'indigo — d'ou les deux
 * corrections ensemble, et `cn()` a la place de la concatenation.
 */
export default function ColorblindToggle({ className }: { className?: string }) {
  const { colorblind } = useChartPrefs();

  return (
    <button
      onClick={() => toggleColorblind()}
      aria-pressed={colorblind}
      title={
        colorblind
          ? 'Colorblind-safe palette active (Wong 2011) — click to revert'
          : 'Switch to colorblind-safe palette (Wong 2011)'
      }
      className={cn(
        'p-1.5 rounded-sm transition-colors',
        colorblind
          ? 'text-accent-ink bg-accent-soft hover:bg-accent-soft'
          : 'text-muted hover:text-primary hover:bg-hover',
        className,
      )}
    >
      {colorblind ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
