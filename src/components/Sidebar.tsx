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
  User as UserIcon,
  Shield,
  LogOut,
  Moon,
  Sun,
  Lock,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import QuotaDisplay from './QuotaDisplay';
import ComparisonSidebarNav from './comparison/ComparisonSidebarNav';
import { useScientificModule } from '@/hooks/useAddOnModules';
import { Dot } from '@/components/ui/dot';

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
  const { theme, toggleTheme } = useTheme();
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
  const userName = user.email?.split('@')[0] || 'User';
  const initials = userName
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();

  // 'prefix' matches the route and its children only — plain startsWith would
  // also light up on an unrelated sibling such as /toolsmith.
  const isActive = (href: string, match: 'exact' | 'prefix' = 'prefix') =>
    match === 'exact'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const isProjectActive = (target: string) => pathname === target || pathname.startsWith(`${target}/`);

  return (
    <aside className="app-sidebar">
      <div
        className="flex h-[var(--topbar-height)] items-center border-b px-4"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.png"
            alt="GenoLens"
            width={120}
            height={38}
            className="h-8 w-auto"
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5">
        <div className="mb-4">
          <span className="nav-section-label">Workspace</span>
          <div className="mt-1.5 space-y-0.5" data-tour="sidebar-workspace">
            {primaryNav.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item${isActive(href, match) ? ' active' : ''}`}
              >
                <Icon className="nav-icon" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {hasProjectContext && projectId && (
          <div className="mb-4">
            <div className="mb-1.5 px-3.5">
              <span className="nav-section-label">
                Project
                <span className="mt-1.5 flex items-center gap-1.5 font-display text-[12px] normal-case tracking-[-0.01em] text-[var(--text-primary)]">
                  <Dot variant="ready" size={7} />
                  <span className="truncate" title={projectLabel}>
                    {projectLabel}
                  </span>
                </span>
              </span>
            </div>
            <div className="space-y-0.5" data-tour="sidebar-project">
              {projectNav.map(({ key, suffix, label, icon: Icon, requiresScience }) => {
                const href = `/projects/${projectId}${suffix}`;
                const locked = requiresScience === true && !scienceUnlocked;
                return (
                  <div key={key}>
                    {locked ? (
                      <span
                        className="nav-item cursor-not-allowed opacity-50"
                        title="Scientific tools add-on — ask an admin to enable it"
                      >
                        <Icon className="nav-icon" />
                        {label}
                        <Lock className="ml-auto h-3 w-3" />
                      </span>
                    ) : (
                      <Link
                        href={href}
                        className={`nav-item${isProjectActive(href) ? ' active' : ''}`}
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
            <div className="mb-1.5 px-3.5">
              <span className="nav-section-label">Admin</span>
            </div>
            <div className="space-y-0.5">
              <Link
                href="/admin"
                className={`nav-item${isActive('/admin') ? ' active' : ''}`}
                style={
                  !isActive('/admin')
                    ? { color: 'var(--sl-red)' }
                    : undefined
                }
              >
                <Shield className="nav-icon" />
                Administration
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div
        className="flex-shrink-0 py-2"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div className="px-4 py-2">
          <QuotaDisplay />
        </div>

        <Link
          href="/profile"
          className={`mx-2.5 mb-1.5 flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 transition-colors ${
            isActive('/profile') ? 'bg-[var(--surface-raised)]' : 'hover:bg-[var(--hover-overlay)]'
          }`}
        >
          <div
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--sl-purple), var(--sl-teal-dark))',
              fontFamily: 'var(--font-syne)',
            }}
          >
            {initials || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">{userName}</p>
            <p className="truncate text-[10.5px] text-[var(--text-muted)]">
              {user.email}
            </p>
          </div>
          <UserIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </Link>

        <div className="flex gap-1 px-2.5">
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="nav-item flex-1 justify-center gap-1.5 !m-0"
          >
            {theme === 'light' ? (
              <Moon className="nav-icon" />
            ) : (
              <Sun className="nav-icon" />
            )}
            <span className="text-[11px]">Theme</span>
          </button>

          <form action="/auth/signout" method="post" className="flex-1">
            <button
              type="submit"
              title="Sign out"
              className="nav-item !m-0 w-full justify-center gap-1.5"
              style={{
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--sl-red)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              <LogOut className="nav-icon" />
              <span className="text-[11px]">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
