'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useUserProfile } from '@/hooks/useCosmetics';
import { DatasetType, DatasetStatus } from '@/types';
import { buildComparisonModules } from './comparisonModules';

interface Props {
  /** Path of the comparison page, without the `?tab=` parameter. */
  basePath: string;
  projectId: string;
}

/**
 * Modules of the comparison currently open, nested under Analyses.
 *
 * Reachable because the open tab lives in the URL: each entry is a plain link
 * to `?tab=…`. A module the project has no data for, or an add-on the user has
 * no access to, is listed but not a link — the sidebar says what exists without
 * promising a view that can't open.
 */
export default function ComparisonSidebarNav({ basePath, projectId }: Props) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';

  const { data: datasets = [] } = useProjectDatasets(projectId);
  const { data: profile } = useUserProfile();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SCILICIUM_ADMIN';

  const modules = useMemo(() => {
    const hasMatrix = datasets.some(
      (d) => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY
    );
    return buildComparisonModules({
      hasMatrix,
      // Only drives a metric label, which the sidebar doesn't show.
      hasEnrichmentFile: false,
      cosmeticsUnlocked: !!profile && (isAdmin || profile.has_cosmetics_module === true),
      reportUnlocked: !!profile && (isAdmin || profile.has_report_customization === true),
      scienceUnlocked: !!profile && (isAdmin || profile.has_scientific_module === true),
      stats: null,
    });
  }, [datasets, profile, isAdmin]);

  const comparisonLabel = decodeURIComponent(basePath.split('/').pop() ?? '');

  const itemClass = 'nav-item !py-1.5 !text-[12px]';

  return (
    <div className="mt-1 mb-1 pl-3" style={{ borderLeft: '1px solid var(--sidebar-border)', marginLeft: '1.125rem' }}>
      <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
        <span className="block truncate" title={comparisonLabel}>{comparisonLabel}</span>
      </div>

      <Link href={basePath} className={`${itemClass}${activeTab === 'overview' ? ' active' : ''}`}>
        Overview
      </Link>

      {modules.map((module) => {
        if (module.state === 'ready' && module.tab) {
          const active = activeTab === module.tab;
          return (
            <Link
              key={module.id}
              href={`${basePath}?tab=${module.tab}`}
              className={`${itemClass}${active ? ' active' : ''}`}
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
            title={locked ? `${module.title} — add-on module, request access from the overview` : `${module.title} — ${module.hint}`}
            className={`${itemClass} cursor-default`}
            style={{ color: 'var(--text-muted)', opacity: 0.7 }}
          >
            {locked && <Lock className="h-3 w-3 flex-shrink-0" />}
            <span className="truncate">{module.title}</span>
          </span>
        );
      })}
    </div>
  );
}
