'use client';

import Link from 'next/link';
import { Network, FlaskConical, Database } from 'lucide-react';

type Tool = {
    name: string;
    description: string;
    icon: typeof Network;
    href: string;
    color: string;
    bgColor: string;
    comingSoon?: boolean;
};

const tools: Tool[] = [
    {
        name: "Gene Ontology Browser",
        description: "Explore GO terms, definitions, and hierarchy relationships (Biological Process, Molecular Function, Cellular Component).",
        icon: Network,
        href: "/tools/ontology",
        color: "text-indigo-600",
        bgColor: "bg-indigo-50"
    },
    {
        name: "Power Analysis",
        description: "Calculate the required sample size or the statistical power of a test. Supports t-tests (two-sample, paired, one-sample) with RNA-seq fold-change → Cohen's d converter.",
        icon: FlaskConical,
        href: "/tools/power-analysis",
        color: "text-purple-600",
        bgColor: "bg-purple-50"
    },
    {
        name: "Public GEO Datasets",
        description: "Search NCBI GEO for public reference datasets to compare against your own experiments.",
        icon: Database,
        href: "#",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        comingSoon: true,
    },
];

export default function ToolsIndexPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Research Tools</h1>
                    <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                        Utilities and databases to support your genomic analysis workflows.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool) => {
                        const card = (
                            <div className={`bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 h-full ${tool.comingSoon ? 'opacity-75' : 'hover:shadow-md transition-shadow duration-200'}`}>
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className={`p-3 rounded-lg inline-block ${tool.bgColor} mb-4`}>
                                            <tool.icon className={`h-8 w-8 ${tool.color}`} />
                                        </div>
                                        {tool.comingSoon && (
                                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                                                Available soon
                                            </span>
                                        )}
                                    </div>
                                    <h3 className={`text-lg font-medium text-gray-900 ${tool.comingSoon ? '' : 'group-hover:text-brand-primary transition-colors'}`}>
                                        {tool.name}
                                    </h3>
                                    <p className="mt-2 text-sm text-gray-500 line-clamp-3">
                                        {tool.description}
                                    </p>
                                </div>
                            </div>
                        );

                        if (tool.comingSoon) {
                            return (
                                <div key={tool.name} className="block cursor-not-allowed" aria-disabled="true">
                                    {card}
                                </div>
                            );
                        }

                        return (
                            <Link key={tool.name} href={tool.href} className="block group">
                                {card}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
