'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface DashboardWelcomeBannerProps {
  userName?: string;
  recentProjectName?: string;
  totalComparisons: number;
  activityLast7Days: number;
  aiInterpretationsUsed: number;
  resumeHref?: string;
}

function getFirstName(name?: string): string | null {
  if (!name) return null;
  // If it looks like an email, use the part before @
  if (name.includes('@')) return name.split('@')[0];
  // Otherwise use the first word
  return name.split(' ')[0];
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScatter(seed = 777) {
  const rnd = mulberry32(seed);
  const width = 900;
  const height = 150;
  const points: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 220; i += 1) {
    const fc = (rnd() - 0.5) * 2;
    const x = width / 2 + fc * (width / 2.4) + (rnd() - 0.5) * 40;
    const y = height - Math.abs(fc) * height * 0.7 - rnd() * 30;
    const r = 1.2 + rnd() * 1.4;
    const o = 0.05 + rnd() * 0.1;
    points.push({ x, y, r, o });
  }
  return points;
}

export default function DashboardWelcomeBanner({
  userName,
  recentProjectName,
  totalComparisons,
  activityLast7Days,
  aiInterpretationsUsed,
  resumeHref,
}: DashboardWelcomeBannerProps) {
  const firstName = getFirstName(userName);
  const scatter = buildScatter();

  return (
    <div
      className="relative overflow-hidden rounded-xl px-6 py-5 mb-6 animate-fade-up"
      style={{
        background:
          'linear-gradient(135deg, var(--sl-teal-light) 0%, color-mix(in srgb, var(--sl-purple) 8%, var(--surface)) 100%)',
        border: '1px solid var(--border)',
      }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 900 150"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {scatter.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="var(--sl-teal)"
            opacity={p.o}
          />
        ))}
      </svg>

      <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2
            className="font-display font-bold tracking-tight"
            style={{ fontSize: '1.375rem', color: 'var(--text-primary)' }}
          >
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Last session: <b>{totalComparisons}</b> comparisons analyzed
            {recentProjectName ? (
              <>
                {' '}
                in <b>{recentProjectName}</b>
              </>
            ) : null}{' '}
            · <b>{aiInterpretationsUsed}</b> AI interpretations used
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface)' }}>
            <div
              className="font-display font-bold leading-none"
              style={{ color: 'var(--sl-teal)', fontSize: '1.2rem' }}
            >
              {activityLast7Days}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Activity (7d)
            </div>
          </div>

          {resumeHref ? (
            <Link
              href={resumeHref}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all"
              style={{ background: 'var(--sl-purple)' }}
            >
              Resume
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
