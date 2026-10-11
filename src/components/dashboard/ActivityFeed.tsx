'use client';

import Link from 'next/link';
import {
  Activity,
  Bookmark,
  BookmarkMinus,
  Boxes,
  GitCompareArrows,
  ListPlus,
  MessageSquare,
  Network,
  Share2,
  Trash2,
  Upload,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityEventType } from '@/types/history';
import type { WorkspaceActivityEntry } from '@/hooks/useWorkspaceActivity';
import { comparisonTitle, formatRelative } from './format';

/**
 * Ce qui s'est passe recemment, dans tous les projets.
 *
 * Une phrase par evenement, sujet-verbe-objet — « You ran GSEA on Treated vs
 * Control » — plutot qu'un type d'evenement brut. Le noeud colore dit la
 * FAMILLE d'action (donnees, analyse, curation, collaboration), la phrase dit
 * le reste ; la couleur n'est donc jamais seule porteuse du sens.
 *
 * `user_id` est l'UUID Supabase de l'auteur : on dit « You » quand c'est
 * l'utilisateur courant, « A collaborator » sinon — l'historique ne porte pas
 * le nom des autres membres.
 */

type Family = 'data' | 'analysis' | 'curation' | 'team';

const EVENTS: Record<ActivityEventType, { verb: string; icon: LucideIcon; family: Family }> = {
  dataset_uploaded: { verb: 'uploaded', icon: Upload, family: 'data' },
  dataset_deleted: { verb: 'deleted', icon: Trash2, family: 'data' },
  comparison_created: { verb: 'created the comparison', icon: GitCompareArrows, family: 'analysis' },
  enrichment_run: { verb: 'ran pathway enrichment on', icon: Network, family: 'analysis' },
  clustering_run: { verb: 'clustered', icon: Boxes, family: 'analysis' },
  gsea_run: { verb: 'ran GSEA on', icon: Activity, family: 'analysis' },
  go_enrichment_run: { verb: 'ran GO enrichment on', icon: Waypoints, family: 'analysis' },
  bookmark_created: { verb: 'bookmarked', icon: Bookmark, family: 'curation' },
  bookmark_batch_created: { verb: 'bookmarked genes from', icon: Bookmark, family: 'curation' },
  bookmark_deleted: { verb: 'removed a bookmark on', icon: BookmarkMinus, family: 'curation' },
  gene_list_created: { verb: 'created the gene list', icon: ListPlus, family: 'curation' },
  comment_added: { verb: 'commented on', icon: MessageSquare, family: 'team' },
  project_shared: { verb: 'shared', icon: Share2, family: 'team' },
};

const FAMILY_STYLE: Record<Family, { bg: string; ink: string }> = {
  data: { bg: 'var(--sl-teal-light)', ink: 'var(--sl-teal-dark)' },
  analysis: { bg: 'var(--sl-violet-light)', ink: 'var(--sl-violet-dark)' },
  curation: { bg: 'color-mix(in oklab, var(--dc-amber) 14%, var(--surface))', ink: 'color-mix(in oklab, var(--dc-amber) 70%, var(--text-primary))' },
  team: { bg: 'var(--surface-secondary)', ink: 'var(--text-secondary)' },
};

function objectOf(e: WorkspaceActivityEntry): string | null {
  if (e.event_type === 'project_shared') return 'the project';
  if (!e.entity_name) return null;
  return e.entity_type === 'comparison' || e.event_type === 'comparison_created'
    ? comparisonTitle(e.entity_name)
    : e.entity_name;
}

interface ActivityFeedProps {
  items: WorkspaceActivityEntry[];
  loading: boolean;
  currentUserId?: string;
}

export default function ActivityFeed({ items, loading, currentUserId }: ActivityFeedProps) {
  return (
    <section aria-labelledby="activity-title">
      <h2 id="activity-title" className="mb-3 text-title text-primary">
        Activity
      </h2>

      {loading && items.length === 0 ? (
        <div className="space-y-4 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="skeleton h-7 w-7 rounded-pill" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-2.5 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="max-w-[40ch] text-caption text-secondary">
          Nothing yet. Uploads, analyses and comments across your projects will gather here.
        </p>
      ) : (
        <ol data-enter className="relative">
          {/* Le rail : un trait continu derriere les noeuds. */}
          <span
            aria-hidden
            className="absolute bottom-4 left-[13.5px] top-4 w-px"
            style={{ background: 'var(--border)' }}
          />
          {items.map((e) => {
            const def = EVENTS[e.event_type] ?? { verb: 'updated', icon: Activity, family: 'team' as Family };
            const tone = FAMILY_STYLE[def.family];
            const Icon = def.icon;
            const actor = currentUserId && e.user_id === currentUserId ? 'You' : 'A collaborator';
            const object = objectOf(e);
            return (
              <li key={e.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                <span
                  className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-pill"
                  style={{ background: tone.bg, color: tone.ink, boxShadow: '0 0 0 3px var(--app-bg)' }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-body-sm leading-snug text-secondary">
                    <span className="font-medium text-primary">{actor}</span> {def.verb}
                    {object && (
                      <>
                        {' '}
                        <span className="font-medium text-primary [overflow-wrap:anywhere]">{object}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 truncate text-caption text-muted">
                    <Link href={`/projects/${e.project_id}`} className="hover:text-primary hover:underline">
                      {e.project_name}
                    </Link>
                    <span aria-hidden> · </span>
                    <time dateTime={e.created_at}>{formatRelative(e.created_at)}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
