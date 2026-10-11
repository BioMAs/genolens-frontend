'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Preference systeme de mouvement reduit, suivie en direct.
 *
 * La regle CSS globale (globals.css) neutralise deja les animations
 * declaratives ; ce hook sert au mouvement pilote en JavaScript (boucles
 * requestAnimationFrame), que le CSS ne peut pas atteindre.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Un nombre qui monte jusqu'a sa valeur au lieu d'y apparaitre.
 *
 * Il repart de la valeur AFFICHEE, pas de zero : une mise a jour des donnees
 * fait glisser le compteur, elle ne le rejoue pas. En mouvement reduit, la
 * cible est rendue
 * directement.
 */
export function useCountUp(target: number, { duration = 900, delay = 0 } = {}): number {
  const reduced = usePrefersReducedMotion();
  // Ne depend QUE de la preference, identique au serveur et a l'hydratation
  // (false des deux cotes). Tester ici l'existence de requestAnimationFrame
  // ferait rendre la cible au serveur et 0 au client : erreur d'hydratation.
  const canAnimate = !reduced;
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (!canAnimate) {
      shown.current = target;
      return;
    }
    const from = shown.current;
    if (from === target) return;
    let raf = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now + delay;
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const v = from + (target - from) * easeOutQuart(t);
      shown.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, canAnimate, duration, delay]);

  return canAnimate ? Math.round(value) : target;
}
