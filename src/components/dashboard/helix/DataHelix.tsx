'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { usePrefersReducedMotion } from '@/hooks/useMotion';
import { useChartPalette } from '@/utils/chartTheme';
import {
  comparisonsToPairs,
  computeFrame,
  easeOutCubic,
  layoutFor,
  pairKey,
  phaseToFace,
  rungX,
  upShare,
  type HelixComparison,
  type HelixLayout,
  type HelixPair,
} from './helixGeometry';

/**
 * L'helice de donnees : une paire de bases par comparaison.
 *
 * Elle remplace l'ancien glyphe (deux courbes et cinq traits) par une helice
 * qui tourne vraiment et qui DIT quelque chose : chaque barreau est une
 * comparaison de l'utilisateur, coupe en deux a la proportion de genes up
 * (brin A) et down (brin B). Les places libres sont en pointille ; la premiere
 * d'entre elles pulse — c'est la que la prochaine comparaison s'inscrira.
 *
 * Le rendu est imperatif : React pose la structure une fois, la boucle
 * d'animation ne fait que reecrire des attributs. Faire passer 60 images par
 * seconde par l'etat React re-rendrait le dashboard entier.
 *
 * Mouvement :
 *   - entree : l'helice se « synthetise » de gauche a droite, les barreaux
 *     poussent depuis l'axe au passage du front, la rotation ralentit jusqu'a
 *     sa vitesse de croisiere ;
 *   - croisiere : un tour en ~28 s, suspendu hors ecran et onglet cache ;
 *   - survol (de l'helice ou de la liste liee) : la rotation amene le barreau
 *     vise de face, part « up » en haut, les autres s'effacent ;
 *   - `prefers-reduced-motion` : ni entree ni croisiere, une image fixe ; le
 *     survol saute directement a la bonne face.
 */

export interface HelixItem extends HelixComparison {
  title: string;
  project_name: string;
  href: string;
}

interface DataHelixProps {
  items: HelixItem[];
  /** Faux tant que les comparaisons chargent : l'entree attend les donnees. */
  ready: boolean;
  /** Paire mise en avant depuis l'exterieur (survol de la liste). */
  activeKey?: string | null;
  onActiveKeyChange?: (key: string | null) => void;
  /** La hauteur vient du conteneur (classe responsive) ; il la faut definie. */
  className?: string;
}

const CRUISE = (Math.PI * 2) / 28_000; // rad/ms
const INTRO_MS = 1500;
const FACE_TAU = 140; // ms — constante de temps du ralliement vers une face
const TIP_HALF = 124; // demi-largeur max de l'info-bulle (240px), plus 4px de marge

function slotsFor(width: number): number {
  return Math.max(8, Math.min(22, Math.round((width - 64) / 26)));
}

export default function DataHelix({
  items,
  ready,
  activeKey = null,
  onActiveKeyChange,
  className,
}: DataHelixProps) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  // Up/down suivent la palette du produit : theme ET mode daltonien.
  const palette = useChartPalette();

  // ── mesure ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    // jsdom n'a pas de ResizeObserver : sans mesure, l'helice ne se dessine
    // simplement pas, et le reste du dashboard se teste sans elle.
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slots = width > 0 && height > 0 ? slotsFor(width) : 0;
  const layout: HelixLayout | null = useMemo(
    () => (slots ? layoutFor(width, height, slots) : null),
    [width, height, slots],
  );
  const pairs: HelixPair[] = useMemo(() => comparisonsToPairs(items, slots), [items, slots]);
  const byKey = useMemo(() => new Map(items.map((it) => [pairKey(it), it])), [items]);
  const frontier = pairs.findIndex((p) => p.ghost);

  const externalIdx = activeKey ? pairs.findIndex((p) => p.key === activeKey) : -1;
  const activeIdx = hoverIdx ?? (externalIdx >= 0 ? externalIdx : null);

  // ── refs vers les noeuds animes ───────────────────────────────────────────
  const clipRef = useRef<SVGRectElement>(null);
  const backA = useRef<SVGPathElement>(null);
  const backB = useRef<SVGPathElement>(null);
  const frontA = useRef<SVGPathElement>(null);
  const frontB = useRef<SVGPathElement>(null);
  const upRefs = useRef<(SVGLineElement | null)[]>([]);
  const downRefs = useRef<(SVGLineElement | null)[]>([]);
  const beadA = useRef<(SVGCircleElement | null)[]>([]);
  const beadB = useRef<(SVGCircleElement | null)[]>([]);

  // Etat de la boucle, hors React.
  const sim = useRef({ phase: 0.6, vel: CRUISE * 6, introStart: -1, last: -1 });
  const activeRef = useRef<number | null>(null);
  const pairsRef = useRef(pairs);
  // La boucle lit ces deux valeurs a chaque image sans redemarrer : on les
  // recopie apres chaque rendu, avant la prochaine image.
  useLayoutEffect(() => {
    activeRef.current = activeIdx;
    pairsRef.current = pairs;
  });

  // Une nouvelle mise en page (redimensionnement) ne rejoue pas l'entree ;
  // l'arrivee des donnees, si.
  useEffect(() => {
    if (ready) sim.current.introStart = -1;
  }, [ready]);

  useEffect(() => {
    if (!layout || !ready) return;

    // Un barreau plus fin que la case qu'il occupe : assez epais pour lire la
    // couleur, assez fin pour que l'ensemble reste une helice, pas un code-barres.
    const stroke = Math.max(2.25, Math.min(3.75, (layout.width - layout.padX * 2) / layout.slots / 7));

    const draw = (introT: number) => {
      const { phase } = sim.current;
      const frame = computeFrame(layout, phase, pairsRef.current);
      const cy = layout.height / 2;
      const sweep = easeOutCubic(introT) * (layout.width + 60);
      const active = activeRef.current;

      clipRef.current?.setAttribute('width', String(Math.max(0, sweep)));
      backA.current?.setAttribute('d', frame.strandA.back);
      backB.current?.setAttribute('d', frame.strandB.back);
      frontA.current?.setAttribute('d', frame.strandA.front);
      frontB.current?.setAttribute('d', frame.strandB.front);

      for (const r of frame.rungs) {
        const grow = Math.max(0, Math.min(1, (sweep - r.x) / 70));
        const g = easeOutCubic(grow);
        const yA = cy + (r.yA - cy) * g;
        const yB = cy + (r.yB - cy) * g;
        const yS = cy + (r.ySplit - cy) * g;
        const depth = 0.55 + 0.45 * r.face;
        const dim = active != null && active !== r.index ? 0.22 : 1;
        const w = active === r.index ? stroke * 1.45 : stroke;

        const up = upRefs.current[r.index];
        const down = downRefs.current[r.index];
        if (up) {
          up.setAttribute('x1', r.x.toFixed(1));
          up.setAttribute('x2', r.x.toFixed(1));
          up.setAttribute('y1', yA.toFixed(1));
          up.setAttribute('y2', yS.toFixed(1));
          up.setAttribute('stroke-width', w.toFixed(2));
          up.setAttribute('opacity', (depth * dim).toFixed(3));
        }
        if (down) {
          down.setAttribute('x1', r.x.toFixed(1));
          down.setAttribute('x2', r.x.toFixed(1));
          down.setAttribute('y1', yS.toFixed(1));
          down.setAttribute('y2', yB.toFixed(1));
          down.setAttribute('stroke-width', w.toFixed(2));
          down.setAttribute('opacity', (depth * dim).toFixed(3));
        }
        const a = beadA.current[r.index];
        const b = beadB.current[r.index];
        // Les perles portent la profondeur : grosses devant, petites derriere.
        if (a) {
          a.setAttribute('cx', r.x.toFixed(1));
          a.setAttribute('cy', yA.toFixed(1));
          a.setAttribute('r', ((1.4 + 1.5 * (r.depthA + 1) / 2) * g).toFixed(2));
          a.setAttribute('opacity', ((0.35 + 0.65 * (r.depthA + 1) / 2) * dim).toFixed(3));
        }
        if (b) {
          b.setAttribute('cx', r.x.toFixed(1));
          b.setAttribute('cy', yB.toFixed(1));
          b.setAttribute('r', ((1.4 + 1.5 * (1 - r.depthA) / 2) * g).toFixed(2));
          b.setAttribute('opacity', ((0.35 + 0.65 * (1 - r.depthA) / 2) * dim).toFixed(3));
        }
      }
    };

    if (reduced) {
      const a = activeRef.current;
      sim.current.phase = a != null ? phaseToFace(layout, a, sim.current.phase) : 0.6;
      draw(1);
      return;
    }

    let raf = 0;
    let visible = true;

    const tick = (now: number) => {
      const s = sim.current;
      if (s.introStart < 0) s.introStart = now;
      const dt = s.last < 0 ? 16 : Math.min(64, now - s.last);
      s.last = now;
      const introT = Math.min(1, (now - s.introStart) / INTRO_MS);

      const a = activeRef.current;
      if (a != null) {
        // Ralliement exponentiel : decelere naturellement et reste
        // interruptible — un nouveau survol change simplement la cible.
        const target = phaseToFace(layout, a, s.phase);
        const k = 1 - Math.exp(-dt / FACE_TAU);
        const step = (target - s.phase) * k;
        s.phase += step;
        s.vel = step / dt;
      } else {
        // Pendant l'entree, l'helice est encore « remontee » : elle tourne
        // vite puis ralentit. Ensuite, retour en douceur a la croisiere.
        const goal = CRUISE * (1 + 7 * Math.pow(1 - introT, 2));
        s.vel += (goal - s.vel) * (1 - Math.exp(-dt / 500));
        s.phase += s.vel * dt;
      }

      draw(introT);
      if (visible) raf = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      sim.current.last = -1;
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    if (wrapRef.current) io.observe(wrapRef.current);

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) start();
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);

    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `activeIdx` ne relance pas la boucle : elle le lit dans activeRef. En
    // mouvement reduit, elle est en revanche la seule occasion de redessiner.
  }, [layout, ready, reduced, pairs, reduced ? activeIdx : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── survol ────────────────────────────────────────────────────────────────
  const setHover = (i: number | null) => {
    setHoverIdx(i);
    const key = i != null && pairs[i] && !pairs[i].ghost ? pairs[i].key : null;
    onActiveKeyChange?.(key);
  };

  const tipIdx = activeIdx;
  const tipPair = tipIdx != null ? pairs[tipIdx] : undefined;
  const tipItem = tipPair && !tipPair.ghost ? byKey.get(tipPair.key) : undefined;
  const showFrontierTip = hoverIdx != null && hoverIdx === frontier;

  const real = pairs.filter((p) => !p.ghost).length;
  const summary =
    real > 0
      ? `Your ${real} most recent comparisons drawn as a DNA helix. Each base pair is one comparison, split by its share of up- and down-regulated genes.`
      : 'An empty DNA helix: each comparison you run will add a base pair.';

  const colW = layout ? (layout.width - layout.padX * 2) / layout.slots : 0;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={
        {
          position: 'relative',
          '--helix-up': palette.up,
          '--helix-down': palette.down,
        } as CSSProperties
      }
      onPointerLeave={() => setHover(null)}
    >
      {layout && (
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={summary}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={`fade-${uid}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.07" stopColor="#fff" stopOpacity="1" />
              <stop offset="0.93" stopColor="#fff" stopOpacity="1" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`mask-${uid}`} maskUnits="userSpaceOnUse">
              <rect x="0" y="-20" width={layout.width} height={layout.height + 40} fill={`url(#fade-${uid})`} />
            </mask>
            <clipPath id={`clip-${uid}`}>
              <rect ref={clipRef} x="0" y="-20" width="0" height={layout.height + 40} />
            </clipPath>
          </defs>

          <g mask={`url(#mask-${uid})`} clipPath={`url(#clip-${uid})`}>
            {/* Brins, cote arriere */}
            <path ref={backA} className="helix-strand helix-strand-a" data-depth="back" fill="none" />
            <path ref={backB} className="helix-strand helix-strand-b" data-depth="back" fill="none" />

            {/* Paires de bases */}
            {pairs.map((p, i) => (
              <g
                key={p.key}
                className={p.ghost ? (i === frontier ? 'helix-ghost helix-frontier' : 'helix-ghost') : 'helix-pair'}
              >
                <line
                  ref={(el) => {
                    upRefs.current[i] = el;
                  }}
                  strokeLinecap="round"
                  style={{ stroke: p.ghost ? 'var(--helix-ghost)' : 'var(--helix-up)' }}
                />
                <line
                  ref={(el) => {
                    downRefs.current[i] = el;
                  }}
                  strokeLinecap="round"
                  style={{ stroke: p.ghost ? 'var(--helix-ghost)' : 'var(--helix-down)' }}
                />
              </g>
            ))}

            {/* Brins, cote avant — par-dessus les barreaux */}
            <path ref={frontA} className="helix-strand helix-strand-a" data-depth="front" fill="none" />
            <path ref={frontB} className="helix-strand helix-strand-b" data-depth="front" fill="none" />

            {pairs.map((p, i) => (
              <g key={`beads-${p.key}`} className="helix-beads">
                <circle
                  ref={(el) => {
                    beadA.current[i] = el;
                  }}
                  style={{ fill: 'var(--helix-a)' }}
                />
                <circle
                  ref={(el) => {
                    beadB.current[i] = el;
                  }}
                  style={{ fill: 'var(--helix-b)' }}
                />
              </g>
            ))}
          </g>

          {/* Cibles de survol : une colonne pleine hauteur par paire. Elles ne
              bougent pas avec la rotation — seul le y des barreaux change —
              donc la paire visee reste sous le pointeur pendant qu'elle se
              tourne de face. Les memes destinations existent au clavier dans
              la liste des derniers resultats. */}
          <g aria-hidden>
            {pairs.map((p, i) => {
              const interactive = !p.ghost || i === frontier;
              if (!interactive) return null;
              const x = rungX(layout, i) - colW / 2;
              return (
                <rect
                  key={`hit-${p.key}`}
                  x={x}
                  y={0}
                  width={colW}
                  height={layout.height}
                  fill="transparent"
                  style={{ cursor: p.ghost ? 'default' : 'pointer' }}
                  onPointerEnter={() => setHover(i)}
                  onClick={() => {
                    const item = byKey.get(p.key);
                    if (item) router.push(item.href);
                  }}
                />
              );
            })}
          </g>
        </svg>
      )}

      {layout && tipIdx != null && (tipItem || showFrontierTip) && (
        <div
          key={tipIdx}
          role="tooltip"
          className="animate-scale-in pointer-events-none absolute z-10 w-max max-w-[240px] rounded-control border px-3 py-2"
          style={{
            left: Math.min(Math.max(rungX(layout, tipIdx), TIP_HALF), layout.width - TIP_HALF),
            top: layout.height / 2 - layout.amplitude - 10,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-raised)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--elev-2)',
          }}
        >
          {tipItem ? (
            <>
              <p className="truncate text-body-sm font-semibold text-primary">{tipItem.title}</p>
              <p className="truncate text-caption text-muted">{tipItem.project_name}</p>
              <p className="mt-1 flex items-center gap-3 text-caption tabular-nums">
                <span className="text-primary">
                  <span aria-hidden style={{ color: palette.up }}>▲</span> {tipItem.deg_up.toLocaleString('en-US')} up
                </span>
                <span className="text-primary">
                  <span aria-hidden style={{ color: palette.down }}>▼</span> {tipItem.deg_down.toLocaleString('en-US')} down
                </span>
                <span className="text-muted">{Math.round(upShare({ up: tipItem.deg_up, down: tipItem.deg_down }) * 100)}% up</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-body-sm font-semibold text-primary">Next base pair</p>
              <p className="text-caption text-muted">Your next comparison will be written here.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
