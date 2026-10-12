'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { useChartPalette } from '@/utils/chartTheme';
import DataHelix, { type HelixItem } from './helix/DataHelix';

/**
 * L'en-tete du dashboard : la salutation a gauche, l'helice a droite.
 *
 * L'ancien en-tete etait une ligne de texte et un bouton ; l'ecran s'ouvrait
 * sur du vide. L'helice occupe desormais ce vide, mais c'est une figure de
 * DONNEES, pas une illustration : chaque paire de bases est une comparaison
 * de l'utilisateur (cf. DataHelix). Elle garde donc sa place meme quand le
 * compte est vide — elle dit alors ce qui viendra la remplir.
 *
 * Une seule action, comme avant : reprendre le dernier projet, ou lire les
 * guides. Le reste des gestes vit dans « Quick actions ».
 */

interface DashboardHeroProps {
  userName?: string;
  recentProjectName?: string;
  resumeHref?: string;
  helixItems: HelixItem[];
  helixReady: boolean;
  activeKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
}

function firstName(name?: string): string | null {
  if (!name) return null;
  if (name.includes('@')) return name.split('@')[0];
  return name.split(' ')[0];
}

/**
 * La date ne se calcule que cote client : rendue par le serveur, elle prendrait
 * son fuseau et l'hydratation la contredirait. Le serveur rend un espace
 * insecable, qui reserve la ligne pour que rien ne saute.
 */
const noSubscribe = () => () => {};
function useToday(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    () => ' ',
  );
}

export default function DashboardHero({
  userName,
  recentProjectName,
  resumeHref,
  helixItems,
  helixReady,
  activeKey,
  onActiveKeyChange,
}: DashboardHeroProps) {
  const name = firstName(userName);
  const today = useToday();
  const palette = useChartPalette();
  const hasResults = helixItems.length > 0;

  const subtitle = hasResults
    ? 'Your work, written as DNA. Each base pair is one comparison — hover it to read the response.'
    : recentProjectName
      ? `Pick up where you left off in ${recentProjectName}. Your first comparison writes the first base pair.`
      : 'Start with a project. Every comparison you run writes a new base pair into this helix.';

  return (
    <section
      data-tour="dashboard-welcome"
      className="grid grid-cols-1 items-center gap-x-12 gap-y-4 pb-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
    >
      <div className="animate-fade-up">
        <p className="eyebrow">{today}</p>
        <h1 className="mt-2 text-display text-primary">
          {name ? `Welcome back, ${name}` : 'Welcome back'}
        </h1>
        <p className="mt-3 max-w-[46ch] text-body text-secondary">{subtitle}</p>

        <div className="mt-6">
          {resumeHref ? (
            <Link href={resumeHref} className={buttonClasses({ className: 'shrink-0' })}>
              {/* Un nom de projet va jusqu'a 255 caracteres : sans borne, le
                  bouton s'etirait hors de sa colonne. */}
              <span className="max-w-[18ch] truncate sm:max-w-[28ch]" title={recentProjectName}>
                Resume {recentProjectName}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ) : (
            <Link href="/docs" className={buttonClasses({ className: 'shrink-0' })}>
              <BookOpen className="h-3.5 w-3.5" />
              Read the guides
            </Link>
          )}
        </div>
      </div>

      <figure className="relative min-w-0">
        {/* Papier millimetre : une trame de points tres legere, qui s'efface
            vers les bords. Elle pose l'helice sur un plan de mesure plutot
            que dans le vide. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(var(--border-strong) 1px, transparent 1.2px)',
            backgroundSize: '18px 18px',
            backgroundPosition: 'center',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 80%)',
            opacity: 0.55,
          }}
        />
        <DataHelix
          className="relative h-[170px] sm:h-[220px]"
          items={helixItems}
          ready={helixReady}
          activeKey={activeKey}
          onActiveKeyChange={onActiveKeyChange}
        />
        <figcaption className="relative mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-caption text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: palette.up }} aria-hidden />
            Up-regulated
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: palette.down }} aria-hidden />
            Down-regulated
          </span>
          <span>1 base pair = 1 comparison</span>
        </figcaption>
      </figure>
    </section>
  );
}
