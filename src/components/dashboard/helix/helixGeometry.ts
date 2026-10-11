/**
 * Geometrie de l'helice de donnees du dashboard.
 *
 * Une double helice couchee, vue de face : les deux brins sont deux sinusoides
 * en opposition de phase, et la PROFONDEUR (devant/derriere) se lit sur le
 * cosinus de la meme phase. C'est ce qui donne l'illusion de rotation : on ne
 * fait tourner qu'un angle, les brins se croisent d'eux-memes.
 *
 * Chaque barreau est une paire de bases, et chaque paire est une comparaison :
 * la moitie issue du brin A porte les genes sur-exprimes, celle issue du brin B
 * les sous-exprimes, en proportion. Une paire « fantome » est une place encore
 * libre — la prochaine comparaison viendra s'y loger.
 *
 * Tout est pur et sans DOM : le composant n'a qu'a poser les attributs.
 */

export interface HelixPair {
  /** Cle stable — `${project_id}::${comparison}` pour une vraie paire. */
  key: string;
  up: number;
  down: number;
  /** Place libre : pas de donnees, dessinee en pointille. */
  ghost?: boolean;
}

export interface HelixLayout {
  width: number;
  height: number;
  /** Nombre de paires de bases le long de l'axe. */
  slots: number;
  /** Tours d'helice sur la largeur utile. */
  turns: number;
  /** Marge laterale : les brins la traversent, les barreaux non. */
  padX: number;
  /** Rayon apparent, en px. */
  amplitude: number;
}

export interface HelixRung {
  index: number;
  x: number;
  /** Extremite sur le brin A (cote « up »). */
  yA: number;
  /** Extremite sur le brin B (cote « down »). */
  yB: number;
  /** Jonction entre la part up et la part down. */
  ySplit: number;
  /** cos(theta) : > 0 quand le brin A passe devant. */
  depthA: number;
  /** 0 quand le barreau est vu par la tranche, 1 quand il est de face. */
  face: number;
}

export interface StrandPaths {
  front: string;
  back: string;
}

export interface HelixFrame {
  strandA: StrandPaths;
  strandB: StrandPaths;
  rungs: HelixRung[];
}

const TAU = Math.PI * 2;

export function layoutFor(width: number, height: number, slots: number): HelixLayout {
  const padX = Math.min(48, Math.max(20, width * 0.06));
  // ~1 tour pour 7 paires : assez de croisements pour lire une helice, assez
  // peu pour que chaque barreau garde de la place.
  const turns = Math.max(1.25, slots / 7);
  return {
    width,
    height,
    slots,
    turns,
    padX,
    amplitude: Math.max(12, height * 0.36),
  };
}

/** Abscisse du barreau `i`, centree dans sa case. */
export function rungX(layout: HelixLayout, i: number): number {
  const usable = layout.width - layout.padX * 2;
  return layout.padX + ((i + 0.5) * usable) / layout.slots;
}

/** Angle propre de l'abscisse `x`, hors phase de rotation. */
function angleAt(layout: HelixLayout, x: number): number {
  const usable = layout.width - layout.padX * 2;
  return (TAU * layout.turns * (x - layout.padX)) / usable;
}

/** Part « up » d'une paire, dans [0, 1]. Une paire vide se partage a parts egales. */
export function upShare(pair: Pick<HelixPair, 'up' | 'down'>): number {
  const total = pair.up + pair.down;
  return total > 0 ? pair.up / total : 0.5;
}

/**
 * Un brin, decoupe en deux traces : les troncons qui passent devant et ceux qui
 * passent derriere. Les barreaux se dessinent ENTRE les deux, ce qui suffit a
 * faire croire a l'occlusion sans calcul de profondeur par pixel.
 */
function strand(layout: HelixLayout, phase: number, sign: 1 | -1, samples: number): StrandPaths {
  const cy = layout.height / 2;
  const R = layout.amplitude;
  let front = '';
  let back = '';
  let prevBucket: 'f' | 'b' | null = null;
  let px = 0;
  let py = 0;

  for (let s = 0; s <= samples; s++) {
    const x = (layout.width * s) / samples;
    const theta = phase + angleAt(layout, x);
    const y = cy + sign * R * Math.sin(theta);

    if (s > 0) {
      const midTheta = phase + angleAt(layout, x - layout.width / samples / 2);
      const bucket: 'f' | 'b' = sign * Math.cos(midTheta) >= 0 ? 'f' : 'b';
      const seg =
        bucket === prevBucket
          ? `L${x.toFixed(1)} ${y.toFixed(1)}`
          : `M${px.toFixed(1)} ${py.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (bucket === 'f') front += seg;
      else back += seg;
      prevBucket = bucket;
    }
    px = x;
    py = y;
  }
  return { front, back };
}

export function computeFrame(
  layout: HelixLayout,
  phase: number,
  pairs: ReadonlyArray<Pick<HelixPair, 'up' | 'down'>>,
  samples = 160,
): HelixFrame {
  const cy = layout.height / 2;
  const R = layout.amplitude;

  const rungs: HelixRung[] = [];
  for (let i = 0; i < layout.slots; i++) {
    const x = rungX(layout, i);
    const theta = phase + angleAt(layout, x);
    const sin = Math.sin(theta);
    const yA = cy + R * sin;
    const yB = cy - R * sin;
    const share = pairs[i] ? upShare(pairs[i]) : 0.5;
    rungs.push({
      index: i,
      x,
      yA,
      yB,
      ySplit: yA + (yB - yA) * share,
      depthA: Math.cos(theta),
      face: Math.abs(sin),
    });
  }

  return {
    strandA: strand(layout, phase, 1, samples),
    strandB: strand(layout, phase, -1, samples),
    rungs,
  };
}

/**
 * Phase a atteindre pour presenter le barreau `i` de face, la moitie « up »
 * en haut — choisie au plus pres de la phase courante, pour que la rotation
 * prenne le chemin court.
 */
export function phaseToFace(layout: HelixLayout, i: number, current: number): number {
  // sin(theta) = -1 met le brin A en haut (y = cy - R) : la part up se lit en
  // premier, de haut en bas.
  const base = -Math.PI / 2 - angleAt(layout, rungX(layout, i));
  const k = Math.round((current - base) / TAU);
  return base + k * TAU;
}

export interface HelixComparison {
  project_id: string;
  name: string;
  deg_up: number;
  deg_down: number;
  updated_at?: string | null;
}

export function pairKey(c: Pick<HelixComparison, 'project_id' | 'name'>): string {
  return `${c.project_id}::${c.name}`;
}

/**
 * Les comparaisons, de la plus ancienne a la plus recente, puis les places
 * libres. L'helice se « synthetise » de gauche a droite : la derniere vraie
 * paire est le front de synthese, la premiere place libre la suivante.
 *
 * Au-dela de `slots`, seules les plus recentes restent.
 */
export function comparisonsToPairs(
  comparisons: ReadonlyArray<HelixComparison>,
  slots: number,
): HelixPair[] {
  const time = (c: HelixComparison) => (c.updated_at ? new Date(c.updated_at).getTime() : 0);
  const chronological = [...comparisons].sort((a, b) => time(a) - time(b)).slice(-slots);

  const pairs: HelixPair[] = chronological.map((c) => ({
    key: pairKey(c),
    up: Math.max(0, c.deg_up || 0),
    down: Math.max(0, c.deg_down || 0),
  }));
  for (let i = pairs.length; i < slots; i++) {
    pairs.push({ key: `ghost-${i}`, up: 0, down: 0, ghost: true });
  }
  return pairs;
}

/** Courbes d'animation partagees — decelerations, jamais de rebond. */
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
