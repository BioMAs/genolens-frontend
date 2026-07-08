'use client';

import type { ReactNode } from 'react';
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

interface TopBarProps {
  rightSlot?: ReactNode;
}

export default function TopBar({ rightSlot }: TopBarProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <header className="app-topbar">
      <div className="flex min-w-0 flex-1 items-center">
        <h1 className="page-title truncate !text-[1rem] !font-semibold !tracking-[-0.01em] !leading-none">
          {pageTitle}
        </h1>
      </div>

      <div className="hidden w-[400px] shrink-0 justify-center md:flex">
        <GlobalGeneSearch variant="topbar" />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{rightSlot}</div>
    </header>
  );
}
