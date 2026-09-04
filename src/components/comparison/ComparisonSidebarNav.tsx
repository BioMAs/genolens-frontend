'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useUserProfile } from '@/hooks/useCosmetics';
import { DatasetType, DatasetStatus } from '@/types';
import { buildComparisonModules, groupModulesByView } from './comparisonModules';
import { buildViewHref, resolveView, type ComparisonView } from './comparisonRoutes';

interface Props {
  /** Path of the comparison page, without any query string. */
  basePath: string;
  projectId: string;
}

/**
 * The comparison's four screens, with the panels each one holds.
 *
 * Before this, eleven modules were eleven flat sidebar entries — the same eleven mutually
 * exclusive panes the tab bar used to show, one level over. Grouping them into Explore,
 * Understand, Apply and Share puts four intentions in front of the reader instead of eleven
 * destinations. The same four, in the same order, are the cards at the top of the results page.
 *
 * Each group heading links to its view; each panel links to an anchor inside it. A module the
 * project has no data for, or an add-on the user has no access to, is listed but not a link —
 * the sidebar says what exists without promising a view that cannot open.
 *
 * Openability is `state === 'ready'`, not the presence of a legacy `tab`: two of the modules
 * (the AI reading and the exports) never had a tab of their own.
 */
export default function ComparisonSidebarNav({ basePath, projectId }: Props) {
  const searchParams = useSearchParams();
  const activeView = resolveView(searchParams);

  const { data: datasets = [] } = useProjectDatasets(projectId);
  const { data: profile } = useUserProfile();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SCILICIUM_ADMIN';

  const groups = useMemo(() => {
    const hasMatrix = datasets.some(
      (d) => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY
    );
    return groupModulesByView(
      buildComparisonModules({
        hasMatrix,
        // Only drives a metric label, which the sidebar doesn't show.
        hasEnrichmentFile: false,
        cosmeticsUnlocked: !!profile && (isAdmin || profile.has_cosmetics_module === true),
        reportUnlocked: !!profile && (isAdmin || profile.has_report_customization === true),
        scienceUnlocked: !!profile && (isAdmin || profile.has_scientific_module === true),
        drugDiscoveryUnlocked:
          !!profile && (isAdmin || profile.has_drug_discovery_module === true),
        stats: null,
      })
    );
  }, [datasets, profile, isAdmin]);

  const comparisonLabel = decodeURIComponent(basePath.split('/').pop() ?? '');
  const itemClass = 'nav-item !py-1.5 !text-[12px]';

  return (
    <div
      className="mt-1 mb-1 pl-3"
      style={{ borderLeft: '1px solid var(--sidebar-border)', marginLeft: '1.125rem' }}
    >
      <div
        className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="block truncate" title={comparisonLabel}>
          {comparisonLabel}
        </span>
      </div>

      {groups.map((group) => {
        // Nothing to show for a view with no modules — Share holds two, so this only ever
        // trims a group the catalogue has emptied.
        if (group.modules.length === 0) return null;

        const heading = (
          <Link
            href={buildViewHref(basePath, group.view)}
            className={`${itemClass}${activeView === group.view ? ' active' : ''}`}
          >
            {group.label}
          </Link>
        );

        const panels = group.modules.map((module) => {
          if (module.state === 'ready') {
            return (
              <Link
                key={module.id}
                href={buildViewHref(basePath, group.view, module.panel)}
                className={`${itemClass} !pl-6 !text-[11px]`}
              >
                {module.title}
              </Link>
            );
          }

          const locked = module.state === 'locked';
          return (
            <span
              key={module.id}
              aria-disabled
              title={
                locked
                  ? `${module.title} — add-on module, request access from "All modules"`
                  : `${module.title} — ${module.hint}`
              }
              className={`${itemClass} !pl-6 !text-[11px] cursor-default`}
              style={{ color: 'var(--text-muted)', opacity: 0.7 }}
            >
              {locked && <Lock className="h-3 w-3 flex-shrink-0" />}
              <span className="truncate">{module.title}</span>
            </span>
          );
        });

        return (
          <div key={group.view}>
            {heading}
            {activeView === group.view ? panels : null}
          </div>
        );
      })}
    </div>
  );
}

export type { ComparisonView };
