'use client';

import { usePathname } from 'next/navigation';
import GlobalGeneSearch from './GlobalGeneSearch';

/** Map route segments to human-readable page titles. */
function resolvePageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Projects';
  if (pathname === '/tools') return 'Tools';
  if (pathname.startsWith('/tools/ontology') && pathname.length > '/tools/ontology'.length) return 'GO Term';
  if (pathname.startsWith('/tools/ontology')) return 'Gene Ontology Browser';
  if (pathname.startsWith('/tools/power-analysis')) return 'Power Analysis';
  if (pathname === '/profile') return 'Profile';
  if (pathname === '/admin') return 'Administration';
  if (pathname.includes('/multi-comparison')) return 'Multi-Comparison';
  if (pathname.includes('/clustering')) return 'Clustering Analysis';
  if (pathname.includes('/enrichment')) return 'Enrichment Analysis';
  if (pathname.includes('/comparisons/')) return 'Comparison';
  if (pathname.includes('/datasets/')) return 'Dataset';
  if (pathname.startsWith('/projects/')) return 'Project';
  return 'GenoLens';
}

export default function TopBar() {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <header className="app-topbar">
      {/* Page title */}
      <h1
        className="font-display font-semibold text-sm flex-shrink-0"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
      >
        {pageTitle}
      </h1>

      {/* Push search to center */}
      <div className="flex-1" />

      {/* Gene search — centered in content area */}
      <div className="w-full max-w-[360px] flex-shrink-0">
        <GlobalGeneSearch />
      </div>

      <div className="flex-1" />
    </header>
  );
}
