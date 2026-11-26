'use client';

import { useEffect, useState } from 'react';
import { partDomId, type ReadingPart } from './readingRoutes';

/** The part shown before anything has been measured, and whenever no part has reached the line. */
const FALLBACK_PART: ReadingPart = 'answers';

/** Pixels short of the very bottom still counted as "at the bottom" (sub-pixel scroll, rounding). */
const BOTTOM_TOLERANCE = 4;

/**
 * La partie en cours de lecture : la dernière dont le haut est passé sous la ligne de lecture.
 *
 * La ligne est à `line × innerHeight` depuis le haut de la fenêtre (30 % par défaut) : une partie
 * devient « lue » quand son haut la franchit, pas quand elle entre dans la fenêtre — sinon la
 * suivante, encore presque entière hors champ, volerait la place de celle qu'on lit.
 *
 * Deux cas particuliers :
 * - tout en bas de la page, c'est la dernière partie présente, même si son haut n'a jamais
 *   franchi la ligne (une dernière partie courte ne l'atteindrait jamais) ;
 * - tant qu'aucune partie n'a franchi la ligne, ou qu'aucune n'est dans la page, c'est `answers`.
 *
 * Une partie absente du DOM (verrouillée, pas encore rendue) est ignorée : elle ne casse pas le
 * suivi des autres. Le calcul se refait au montage, à chaque `scroll` (écouteur passif, c'est la
 * fenêtre qui défile) et à chaque `resize`, puisque la ligne dépend de la hauteur de la fenêtre.
 *
 * `parts` est lu dans l'ordre de la page. Le tableau passé peut être neuf à chaque rendu : seul
 * son contenu compte, les écouteurs ne sont donc pas reposés pour rien.
 */
export function useActivePart(parts: readonly ReadingPart[], line = 0.3): ReadingPart {
  const [active, setActive] = useState<ReadingPart>(FALLBACK_PART);
  const partsKey = parts.join(',');

  useEffect(() => {
    const ordered = partsKey ? (partsKey.split(',') as ReadingPart[]) : [];

    const measure = () => {
      const present = ordered.flatMap((part) => {
        const el = document.getElementById(partDomId(part));
        return el ? [{ part, top: el.getBoundingClientRect().top }] : [];
      });
      if (present.length === 0) return setActive(FALLBACK_PART);

      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - BOTTOM_TOLERANCE;
      if (atBottom) return setActive(present[present.length - 1].part);

      const readingLine = line * window.innerHeight;
      const passed = present.filter(({ top }) => top <= readingLine);
      setActive(passed.length > 0 ? passed[passed.length - 1].part : FALLBACK_PART);
    };

    // La position est lue aussi au montage : un retour arrière restaure la page à mi-hauteur
    // avant que ce hook n'existe, et aucun événement ne suivra.
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [partsKey, line]);

  return active;
}
