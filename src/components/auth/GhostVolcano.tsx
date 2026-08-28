/**
 * Ghost volcano plot — the brand panel's ground.
 *
 * A volcano plot is the canonical image of differential expression, so the
 * login panel is grounded in the product's own subject matter rather than in
 * decoration. Ported from mockup/GenoLens Auth.html.
 *
 * The points are generated ONCE at module scope from a seeded PRNG. That is
 * deliberate: React renders this on the server and again on the client, and
 * anything non-deterministic here (Math.random, Date) would hydrate-mismatch.
 * Same seed → same markup → no mismatch, and the plot is stable across reloads.
 */

const W = 480;
const H = 320;
const PAD = { l: 30, r: 24, t: 18, b: 26 };

const FC_MIN = -6;
const FC_MAX = 6;
const P_MIN = 0;
const P_MAX = 8;
const FC_THRESHOLD = 0.9;
const P_THRESHOLD = 1.6;

const x0 = PAD.l;
const x1 = W - PAD.r;
const y0 = H - PAD.b;
const y1 = PAD.t;

const sx = (v: number) => x0 + ((v - FC_MIN) / (FC_MAX - FC_MIN)) * (x1 - x0);
const sy = (v: number) => y0 + ((v - P_MIN) / (P_MAX - P_MIN)) * (y1 - y0);

/** mulberry32 — small, fast, fully deterministic from its seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = { cx: string; cy: string; r: string; o: string; sig: boolean };

const POINTS: Point[] = (() => {
  const rnd = mulberry32(424242);
  const out: Point[] = [];

  for (let i = 0; i < 210; i++) {
    let fc: number;
    let p: number;
    let sig: boolean;

    const roll = rnd();
    if (roll < 0.6) {
      // non-significant bulk: fold change near zero, low significance
      fc = (rnd() - 0.5) * 2.4;
      p = rnd() * rnd() * 2.2;
      sig = false;
    } else if (roll < 0.8) {
      // up-regulated wing
      fc = FC_THRESHOLD + rnd() * 4.2;
      p = P_THRESHOLD + rnd() * 5.2;
      sig = true;
    } else {
      // down-regulated wing
      fc = -FC_THRESHOLD - rnd() * 4.2;
      p = P_THRESHOLD + rnd() * 5.2;
      sig = true;
    }

    fc = Math.min(Math.max(fc, FC_MIN + 0.2), FC_MAX - 0.2);
    p = Math.min(p, P_MAX - 0.2);

    out.push({
      cx: sx(fc).toFixed(1),
      cy: sy(p).toFixed(1),
      r: (0.9 + rnd() * 2.0).toFixed(1),
      o: (sig ? 0.1 + rnd() * 0.04 : 0.05 + rnd() * 0.03).toFixed(3),
      sig,
    });
  }
  return out;
})();

const GUIDE = 'rgba(255,255,255,0.07)';
const AXIS = 'rgba(255,255,255,0.10)';

export default function GhostVolcano({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={AXIS} strokeWidth="1" />
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke={AXIS} strokeWidth="1" />

      <line x1={sx(-FC_THRESHOLD)} y1={y1} x2={sx(-FC_THRESHOLD)} y2={y0} stroke={GUIDE} strokeWidth="1" strokeDasharray="3 4" />
      <line x1={sx(FC_THRESHOLD)} y1={y1} x2={sx(FC_THRESHOLD)} y2={y0} stroke={GUIDE} strokeWidth="1" strokeDasharray="3 4" />
      <line x1={x0} y1={sy(P_THRESHOLD)} x2={x1} y2={sy(P_THRESHOLD)} stroke={GUIDE} strokeWidth="1" strokeDasharray="3 4" />

      <g className="gl-volcano-points">
        {POINTS.map((pt, i) => (
          <circle
            key={i}
            cx={pt.cx}
            cy={pt.cy}
            r={pt.r}
            fill="#fff"
            // Target opacity travels as a custom property: the reveal keyframe animates
            // *to* var(--o), so the per-point depth survives the animation.
            style={
              {
                '--o': pt.o,
                animationDelay: `${(i % 40) * 18}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  );
}
