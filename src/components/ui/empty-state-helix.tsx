import * as React from 'react';
import { cn } from '@/lib/cn';
import { computeFrame, layoutFor } from '@/components/dashboard/helix/helixGeometry';

export interface EmptyStateHelixProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Le glyphe : la meme helice que celle du dashboard, en miniature et figee.
 *
 * L'ancien dessin etait deux courbes de Bezier croisees et cinq traits
 * horizontaux — une echelle tordue plutot qu'une helice : pas de profondeur,
 * des barreaux qui ne touchaient pas les brins. Celui-ci sort du meme moteur
 * que l'helice de donnees (`helixGeometry`), donc il en a la profondeur et le
 * vocabulaire : des places libres en pointille, et la premiere qui pulse,
 * la ou viendra le premier resultat.
 *
 * Calcule une fois au chargement du module : la phase est fixe, le rendu est
 * identique cote serveur et client.
 */
const W = 96;
const H = 44;
const SLOTS = 7;
const LAYOUT = layoutFor(W, H, SLOTS);
const FRAME = computeFrame({ ...LAYOUT, padX: 10, turns: 1.15 }, 0.9, []);

function HelixGlyph() {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden className="mb-2 overflow-visible">
      <path d={FRAME.strandA.back} className="helix-strand helix-strand-a" data-depth="back" />
      <path d={FRAME.strandB.back} className="helix-strand helix-strand-b" data-depth="back" />
      {FRAME.rungs.map((r) => (
        <g key={r.index} className={r.index === 3 ? 'helix-ghost helix-frontier' : 'helix-ghost'}>
          <line
            x1={r.x}
            x2={r.x}
            y1={r.yA}
            y2={r.yB}
            strokeWidth={2.4}
            strokeLinecap="round"
            style={{ stroke: 'var(--helix-ghost)' }}
            opacity={0.55 + 0.45 * r.face}
          />
        </g>
      ))}
      <path d={FRAME.strandA.front} className="helix-strand helix-strand-a" data-depth="front" />
      <path d={FRAME.strandB.front} className="helix-strand helix-strand-b" data-depth="front" />
      {FRAME.rungs.map((r) => (
        <g key={`b-${r.index}`}>
          <circle cx={r.x} cy={r.yA} r={1.3 + 1.2 * ((r.depthA + 1) / 2)} style={{ fill: 'var(--helix-a)' }} />
          <circle cx={r.x} cy={r.yB} r={1.3 + 1.2 * ((1 - r.depthA) / 2)} style={{ fill: 'var(--helix-b)' }} />
        </g>
      ))}
    </svg>
  );
}

function EmptyStateHelix({
  title,
  description,
  action,
  className = '',
  style,
  ...props
}: EmptyStateHelixProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-2 rounded-card p-8 text-center', className)}
      style={{
        border: '1.5px dashed var(--border)',
        background: 'transparent',
        ...style,
      }}
      {...props}
    >
      <HelixGlyph />
      <h4
        className="font-display font-semibold"
        style={{ fontSize: 15, color: 'var(--text-primary)' }}
      >
        {title}
      </h4>
      {description && (
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 12.5,
            maxWidth: 280,
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyStateHelix };
