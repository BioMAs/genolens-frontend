'use client';

import Link from 'next/link';
import { Network, FlaskConical, ChevronRight } from 'lucide-react';

type Tool = {
    name: string;
    description: string;
    icon: typeof Network;
    href: string;
    /** CSS variable pair for the icon tile. */
    tint: { background: string; color: string };
};

/**
 * Standalone utilities only. Drug Discovery and public GEO import are reached
 * from the analyses they belong to, not from here.
 */
const tools: Tool[] = [
    {
        name: "Gene Ontology Browser",
        description: "Explore GO terms, definitions, and hierarchy relationships (Biological Process, Molecular Function, Cellular Component).",
        icon: Network,
        href: "/tools/ontology",
        tint: { background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' },
    },
    {
        name: "Power Analysis",
        description: "Calculate the required sample size or the statistical power of a test. Supports t-tests (two-sample, paired, one-sample) with RNA-seq fold-change → Cohen's d converter.",
        icon: FlaskConical,
        href: "/tools/power-analysis",
        tint: { background: 'var(--sl-teal-light)', color: 'var(--sl-teal-dark)' },
    },
];

export default function ToolsIndexPage() {
    return (
        <div className="page-container">
            <div className="mb-5">
                <h2
                    className="font-display font-bold tracking-tight"
                    style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}
                >
                    Research Tools
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Standalone utilities and databases that work outside a project.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool, i) => (
                    <Link
                        key={tool.name}
                        href={tool.href}
                        className="group gl-card gl-card-interactive flex flex-col p-5 animate-fade-up"
                        style={{ animationDelay: `${i * 40}ms` }}
                    >
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                                style={{ background: tool.tint.background }}
                            >
                                <tool.icon className="h-4.5 w-4.5" style={{ color: tool.tint.color }} />
                            </div>
                            <ChevronRight
                                className="mt-0.5 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                                style={{ color: 'var(--text-muted)' }}
                            />
                        </div>

                        <h3
                            className="font-display text-sm font-semibold leading-snug mb-1.5"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {tool.name}
                        </h3>
                        <p
                            className="text-xs leading-relaxed line-clamp-3"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {tool.description}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
