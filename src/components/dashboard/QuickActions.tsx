'use client';

import Link from 'next/link';
import { ArrowRight, FlaskConical, Search, Sparkles, Wrench, type LucideIcon } from 'lucide-react';
import { KbdHint } from '@/components/ui/kbd-hint';
import { openCommandPalette } from '@/components/command/commandPaletteStore';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useQuotas } from '@/hooks/useQuotas';
import type { UserComparisonItem } from '@/hooks/useAllComparisons';
import { comparisonTitle } from './format';

/**
 * Quatre gestes, en liste de commandes plutot qu'en grille de tuiles.
 *
 * Une grille 2x2 « icone + titre + phrase » est le gabarit le plus generique
 * qui soit, et elle donne a chaque action le meme poids. Une liste se lit de
 * haut en bas dans l'ordre d'usage, et chaque ligne dit ce qu'elle fera avec
 * le contexte de l'utilisateur : le projet ou l'analyse demarrera, la
 * comparaison dont l'IA parlera, le nombre de questions qu'il lui reste.
 *
 * La creation de projet n'y figure pas : elle a deja sa place dans l'en-tete
 * des projets recents, et deux boutons pour un meme geste se contredisent.
 */

interface QuickActionsProps {
  /** Projet le plus recent : la nouvelle analyse y demarre. */
  project?: { id: string; name: string };
  /** Comparaison la plus recente : l'IA s'ouvre sur elle. */
  latest?: UserComparisonItem;
}

interface RowProps {
  icon: LucideIcon;
  tone: string;
  title: string;
  hint: React.ReactNode;
  trailing?: React.ReactNode;
}

function RowBody({ icon: Icon, tone, title, hint, trailing }: RowProps) {
  return (
    <>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control"
        style={{ background: `color-mix(in oklab, ${tone} 12%, var(--surface))`, color: tone }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-sm font-semibold text-primary">{title}</span>
        <span className="block truncate text-caption text-muted">{hint}</span>
      </span>
      {trailing ?? (
        // Le relief au survol passe par le fond de la ligne ; seule la fleche
        // avance — une affordance de 16px, qui ne deplace aucun contenu.
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
    </>
  );
}

const ROW =
  'group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55';

export default function QuickActions({ project, latest }: QuickActionsProps) {
  const { openChatWith } = useChatMode();
  const { ai } = useQuotas();

  const aiExhausted = !ai.unlimited && ai.credits === 0;
  const aiHint = !latest
    ? 'Run a comparison first'
    : aiExhausted
      ? 'No AI questions left this period'
      : `About ${comparisonTitle(latest.name)}${
          ai.unlimited ? '' : ai.credits != null ? ` · ${ai.credits} left` : ''
        }`;

  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="mb-3 text-title text-primary">
        Quick actions
      </h2>
      <div className="gl-card divide-y divide-[var(--border)] overflow-hidden">
        {project ? (
          <Link href={`/projects/${project.id}/analyses/new`} className={ROW}>
            <RowBody
              icon={FlaskConical}
              tone="var(--sl-teal)"
              title="New analysis"
              hint={`Upload counts or import from GEO · ${project.name}`}
            />
          </Link>
        ) : (
          <button type="button" className={ROW} disabled title="Create a project first">
            <RowBody icon={FlaskConical} tone="var(--sl-teal)" title="New analysis" hint="Create a project first" />
          </button>
        )}

        <button type="button" onClick={openCommandPalette} className={ROW} aria-keyshortcuts="Meta+K Control+K">
          <RowBody
            icon={Search}
            tone="var(--sl-purple)"
            title="Find a gene"
            hint="Search any gene across your results"
            trailing={<KbdHint>⌘K</KbdHint>}
          />
        </button>

        <button
          type="button"
          className={ROW}
          disabled={!latest || aiExhausted}
          onClick={() =>
            latest &&
            openChatWith({ projectId: latest.project_id, datasetId: latest.dataset_id, comparisonName: latest.name })
          }
        >
          <RowBody icon={Sparkles} tone="var(--sl-violet)" title="Ask the AI" hint={aiHint} />
        </button>

        <Link href="/tools" className={ROW}>
          <RowBody
            icon={Wrench}
            tone="var(--text-secondary)"
            title="Scientific tools"
            hint="Power analysis, ontology, drug discovery"
          />
        </Link>
      </div>
    </section>
  );
}
