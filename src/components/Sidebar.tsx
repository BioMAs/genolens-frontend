'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Wrench,
  User as UserIcon,
  Shield,
  LogOut,
  Moon,
  Sun,
  Dna,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import QuotaDisplay from './QuotaDisplay';

interface SidebarProps {
  user: User;
  userRole: string | null;
}

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tools', label: 'Tools', icon: Wrench },
];

export default function Sidebar({ user, userRole }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = userRole?.toLowerCase() === 'admin';

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="app-sidebar">
      {/* ── Brand / Logo ── */}
      <div
        className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--sl-teal-light)' }}
        >
          <Dna className="h-4 w-4" style={{ color: 'var(--sl-teal-dark)' }} />
        </div>
        <span
          className="font-display font-bold tracking-tight text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          GenoLens
        </span>
      </div>

      {/* ── Primary Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="mb-2 px-3.5">
          <span className="nav-section-label">Workspace</span>
        </div>

        <div className="space-y-0.5">
          {primaryNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item${isActive(href) ? ' active' : ''}`}
            >
              <Icon className="nav-icon" />
              {label}
            </Link>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="mt-4 mb-2 px-3.5">
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
          </>
        )}
      </nav>

      {/* ── Bottom Controls ── */}
      <div
        className="flex-shrink-0 py-2"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {/* Quota */}
        <div className="px-4 py-2">
          <QuotaDisplay />
        </div>

        {/* Profile link */}
        <Link
          href="/profile"
          className={`nav-item${isActive('/profile') ? ' active' : ''}`}
        >
          <UserIcon className="nav-icon" />
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium truncate"
              style={{ color: 'inherit' }}
            >
              {user.email}
            </p>
          </div>
        </Link>

        {/* Theme + Sign out row */}
        <div className="flex gap-0.5 px-1 mt-0.5">
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="nav-item flex-1 justify-center !gap-0"
            style={{ margin: '0 0.25rem' }}
          >
            {theme === 'light' ? (
              <Moon className="nav-icon" />
            ) : (
              <Sun className="nav-icon" />
            )}
          </button>

          <form action="/auth/signout" method="post" className="flex-1">
            <button
              type="submit"
              title="Sign out"
              className="nav-item w-full justify-center !gap-0"
              style={{
                margin: '0 0.25rem',
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
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
