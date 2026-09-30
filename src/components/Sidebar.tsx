'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { useProject } from '@/hooks/useProjects';
import {
  LayoutDashboard,
  Wrench,
  FolderKanban,
  Database,
  FlaskConical,
  GitCompareArrows,
  Shield,
  Lock,
  BookOpen,
} from 'lucide-react';
import QuotaDisplay from './QuotaDisplay';
import ComparisonSidebarNav from './comparison/ComparisonSidebarNav';
import ProjectSwitcher from './sidebar/ProjectSwitcher';
import UserMenu from './sidebar/UserMenu';
import { useScientificModule } from '@/hooks/useAddOnModules';
import { useUserProfile } from '@/hooks/useUserProfile';
import { canUseMultiComparison, PLAN_GATE_COPY } from '@/utils/plan';
import { cn } from '@/lib/cn';

interface SidebarProps {
  user: User;
  userRole: string | null;
}

/**
 * `match: 'exact'` keeps a workspace item dark once you descend into a project:
 * /projects/{id}/… belongs to the Project group rendered below, not to Projects.
 */
const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: 'exact' },
  { href: '/projects', label: 'Projects', icon: FolderKanban, match: 'exact' },
  { href: '/comparisons', label: 'Comparisons', icon: GitCompareArrows, match: 'exact' },
  { href: '/tools', label: 'Tools', icon: Wrench, match: 'prefix' },
  // 'prefix' : l'entrée reste allumée sur /docs/<slug>.
  { href: '/docs', label: 'Documentation', icon: BookOpen, match: 'prefix' },
] as const;

const projectNav = [
  { key: 'overview', suffix: '', label: 'Overview', icon: FolderKanban },
  { key: 'setup', suffix: '/setup', label: 'Setup', icon: Database },
  { key: 'analyses', suffix: '/analyses', label: 'Analyses', icon: FlaskConical },
  {
    key: 'multi-comparison',
    suffix: '/multi-comparison',
    label: 'Multi-comparison',
    icon: GitCompareArrows,
    /** Plan entitlement `multi_comparison` — Pro and above. */
    requiresTeamPlan: true,
  },
  {
    key: 'contrast-scatter',
    suffix: '/contrast-scatter',
    label: 'Contrast scatter',
    icon: GitCompareArrows,
    /** Part of the Scientific tools add-on — locked without it. */
    requiresScience: true,
  },
];

export default function Sidebar({ user, userRole }: SidebarProps) {
  const pathname = usePathname();
  const { unlocked: scienceUnlocked } = useScientificModule();
  const { data: planProfile } = useUserProfile();
  const multiComparisonUnlocked = canUseMultiComparison(planProfile);
  const isAdmin = userRole?.toLowerCase() === 'admin';
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;
  // On a comparison page, its modules are listed under Analyses.
  const comparisonMatch = pathname.match(
    /^(\/projects\/[^/]+(?:\/analyses\/[^/]+)?\/comparisons\/[^/]+)/
  );
  const comparisonBasePath = comparisonMatch?.[1] ?? null;
  const hasProjectContext = Boolean(projectId);
  // Resolve the human project name; fall back to the id while it loads.
  const { data: currentProject } = useProject(projectId ?? '', hasProjectContext);
  const projectLabel =
    currentProject?.name ?? (projectId ? decodeURIComponent(projectId) : '');

  // 'prefix' matches the route and its children only — plain startsWith would
  // also light up on an unrelated sibling such as /toolsmith.
  const isActive = (href: string, match: 'exact' | 'prefix' = 'prefix') =>
    match === 'exact'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const isProjectActive = (target: string) => pathname === target || pathname.startsWith(`${target}/`);

  return (
    <aside className="app-sidebar">
      {/* En-tete a la meme hauteur que la barre de contexte : la coquille lit
          56 / flex / 56 sur les deux axes. Le logo passe de 32 a 24px — 64px de
          chrome pour un logo de 32 etait disproportionne. */}
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center px-4">
        <Link href="/dashboard" className="flex items-center">
          <Image src="/logo.png" alt="GenoLens" width={120} height={38} className="h-6 w-auto" priority />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="mb-6">
          <span className="nav-section-label mb-2">Workspace</span>
          <div className="space-y-1" data-tour="sidebar-workspace">
            {primaryNav.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                className={cn('nav-item', isActive(href, match) ? ' active' : '')}
              >
                <Icon className="nav-icon" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {hasProjectContext && projectId && (
          <div className="mb-6">
            {/* Remplace un libelle de section qui contenait lui-meme un span avec
                une puce et le nom — un libelle dans un libelle — et qui obligeait
                a remonter a /projects pour changer de projet. */}
            <ProjectSwitcher projectId={projectId} projectLabel={projectLabel} />
            <div className="mt-1 space-y-1" data-tour="sidebar-project">
              {projectNav.map(({ key, suffix, label, icon: Icon, requiresScience, requiresTeamPlan }) => {
                const href = `/projects/${projectId}${suffix}`;
                // Two independent reasons an entry can be locked: an add-on the
                // admin has not enabled, or a plan entitlement. They are not the
                // same thing and the tooltip has to say which.
                const lockedByAddOn = requiresScience === true && !scienceUnlocked;
                const lockedByPlan = requiresTeamPlan === true && !multiComparisonUnlocked;
                const locked = lockedByAddOn || lockedByPlan;
                const lockReason = lockedByPlan
                  ? PLAN_GATE_COPY.multiComparison
                  : 'Scientific tools add-on — ask an admin to enable it';
                return (
                  <div key={key}>
                    {locked ? (
                      <span
                        className="nav-item cursor-not-allowed opacity-50"
                        title={lockReason}
                      >
                        <Icon className="nav-icon" />
                        {label}
                        <Lock className="ml-auto h-3 w-3" />
                      </span>
                    ) : (
                      <Link
                        href={href}
                        className={cn('nav-item', isProjectActive(href) ? ' active' : '')}
                      >
                        <Icon className="nav-icon" />
                        {label}
                      </Link>
                    )}
                    {key === 'analyses' && comparisonBasePath && (
                      <ComparisonSidebarNav basePath={comparisonBasePath} projectId={projectId} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isAdmin && (
          <div>
            <span className="nav-section-label mb-2">Admin</span>
            <Link
              href="/admin"
              className={cn('nav-item nav-item--danger', isActive('/admin') ? ' active' : '')}
            >
              <Shield className="nav-icon" />
              Administration
            </Link>
          </div>
        )}
      </nav>

      {/* Pied : une rangee au lieu de trois bandes. Les quotas se lisent d'un
          coup d'oeil, le reste vit dans le menu utilisateur. */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] py-2">
        <div className="px-4 pb-2">
          <QuotaDisplay />
        </div>
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
