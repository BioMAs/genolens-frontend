'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

/**
 * Ouverture du tiroir de navigation sous 768px.
 *
 * `.app-sidebar` faisait 236px sans aucune media query : a 375px il restait
 * 139px de contenu. La sidebar devient un tiroir hors ecran, que ce bouton
 * fait glisser en basculant `data-nav` sur `.app-shell`.
 *
 * L'etat vit sur le DOM plutot que dans un contexte React parce que
 * AppShell est un composant serveur : y introduire un provider client
 * obligerait a repasser tout le shell cote client pour un booleen.
 */
export default function MobileNavToggle() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    shell.setAttribute('data-nav', open ? 'open' : 'closed');
  }, [open]);

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
        onClick={() => setOpen((v) => !v)}
        // 44x44 : c'est le minimum tactile, et ce bouton n'existe que sur mobile.
        className="mobile-nav-toggle inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-secondary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Voile : ferme au clic, et isole visuellement le tiroir du contenu. */}
      {open && (
        <div
          className="mobile-nav-scrim"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
