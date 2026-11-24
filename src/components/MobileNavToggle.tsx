'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

/**
 * Le tiroir de navigation sous 60rem, et le bouton qui l'ouvre.
 *
 * Sous 60rem la barre du haut n'a plus la place des trois destinations ni de
 * l'aide : elles passent dans ce tiroir, qui glisse depuis la gauche. Le bouton
 * POSSEDE l'etat et rend le tiroir (son contenu lui est passe en enfants) : il
 * n'y a qu'un endroit ou se decide s'il est ouvert, et le CSS ne lit que
 * `data-state` sur le tiroir lui-meme. L'ancienne sidebar-tiroir etait un frere
 * eloigne dans l'arbre, ce qui obligeait a passer par un attribut pose sur
 * `.app-shell` ; ce detour n'a plus d'objet.
 *
 * Quatre manieres de le fermer : le bouton, le voile, Echap, et naviguer. Une
 * cinquieme s'ajoute avec le contenu : activer un lien ou un bouton DU tiroir —
 * y compris vers la page deja ouverte, qui ne change pas d'URL, ou « Take the
 * tour », qui demarrerait la visite sous un tiroir resté ouvert.
 *
 * Il est masque par le CSS a partir de 60rem (`.mobile-nav-toggle`,
 * `.mobile-nav-scrim`, `.app-drawer`).
 */
export default function MobileNavToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerId = useId();

  // Naviguer ferme le tiroir : sans cela il masquerait la page qu'on vient
  // d'ouvrir, et l'utilisateur devrait le refermer a la main a chaque lien.
  //
  // Ajustement pendant le rendu plutot qu'un effet : appeler setState dans un
  // effet declenche un rendu en cascade (l'ecran est peint avec le tiroir
  // encore ouvert, puis repeint). React re-rend ici immediatement, sans
  // valider le premier passage.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((v) => !v)}
        // 44x44 : c'est le minimum tactile, et ce bouton n'existe que sous 60rem.
        // Fantome, comme les autres boutons d'icone de la barre : la bordure
        // appartenait a l'ancienne barre de contexte, qui n'avait pas de fond.
        className="mobile-nav-toggle inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-secondary transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>

      {/* Voile : ferme au clic, et isole visuellement le tiroir du contenu. */}
      {open && (
        <div
          className="mobile-nav-scrim"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Delegation : un seul ecouteur pour tous les liens et boutons du contenu.
          Le gestionnaire du bouton s'execute d'abord (phase cible), la fermeture
          ensuite (phase de remontee) : « Take the tour » agit, puis le tiroir se
          retire. */}
      <div
        id={drawerId}
        className="app-drawer"
        data-state={open ? 'open' : 'closed'}
        onClick={(e) => {
          if ((e.target as Element).closest('a, button')) setOpen(false);
        }}
      >
        {children}
      </div>
    </>
  );
}
