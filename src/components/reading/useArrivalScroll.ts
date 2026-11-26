'use client';

/**
 * Le défilement d'arrivée de la lecture, tenu jusqu'à ce que la page se pose.
 *
 * Un lien vers une partie basse (`#part-skin`, un ancien `?panel=cosmomics`) défilait une fois, au
 * montage. Mais les chapitres au-dessus arrivent ensuite — comptes, volcano, gènes, processus,
 * lecture IA — et poussent la partie vers le bas : sans ancrage de défilement (Safari), le lecteur
 * restait au milieu du volcano.
 *
 * La demande passe donc par `useDeferredAnchorScroll`, comme dans l'ancienne page, et la cible
 * est **tenue** : chaque fois que le contenu au-dessus change de forme, on y retourne. Deux
 * signaux le disent — `layoutKey`, qui change quand une donnée de la page arrive (la page y met
 * ses états de chargement), et, là où le navigateur sait le suivre, la hauteur de l'élément
 * `watched` (un graphique qui se dessine, un panneau qui charge ses propres données).
 *
 * Le lecteur garde la main : dès qu'il fait défiler, touche, clique ou tape une touche, la cible
 * est lâchée et plus rien ne le ramène.
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useDeferredAnchorScroll } from '@/hooks/useDeferredAnchorScroll';

/** Les gestes du lecteur qui mettent fin à l'arrivée. Pas `scroll` : nos propres défilements en émettent. */
const RELEASE_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

export function useArrivalScroll(
  layoutKey: unknown,
  watched: RefObject<HTMLElement | null>
): (id: string) => void {
  const target = useRef<string | null>(null);
  const requestScroll = useDeferredAnchorScroll(layoutKey);

  useEffect(() => {
    const release = () => {
      target.current = null;
    };
    for (const type of RELEASE_EVENTS) {
      window.addEventListener(type, release, { capture: true, passive: true });
    }
    return () => {
      for (const type of RELEASE_EVENTS) window.removeEventListener(type, release, { capture: true });
    };
  }, []);

  // Une donnée est arrivée au-dessus : la partie a pu descendre.
  useEffect(() => {
    if (target.current !== null) requestScroll(target.current);
  }, [layoutKey, requestScroll]);

  // Ce que les états de chargement ne disent pas : la hauteur de la lecture elle-même.
  useEffect(() => {
    const node = watched.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (target.current !== null) requestScroll(target.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [watched, requestScroll]);

  return useCallback(
    (id: string) => {
      target.current = id;
      requestScroll(id);
    },
    [requestScroll]
  );
}
