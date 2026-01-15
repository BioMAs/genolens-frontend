'use client';

import Link from 'next/link';
import { Network, Database, Activity, FileText } from 'lucide-react';

const tools = [
    {
        name: "Gene Ontology Browser",
        description: "Explore GO terms, definitions, and hierarchy relationships (Biological Process, Molecular Function, Cellular Component).",
        icon: Network,
        href: "/tools/ontology",
        color: "text-indigo-600",
        bgColor: "bg-indigo-50"
    },
    // We can add placeholders for other potential tools or link to existing features if they fit here
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
                    {tools.map((tool) => (
                        <Link 
                            key={tool.name} 
                            href={tool.href}
                            className="block group"
                        >
                            <div className="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 h-full">
                                <div className="p-6">
                                    <div className={`p-3 rounded-lg inline-block ${tool.bgColor} mb-4`}>
                                        <tool.icon className={`h-8 w-8 ${tool.color}`} />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 group-hover:text-brand-primary transition-colors">
                                        {tool.name}
                                    </h3>
                                    <p className="mt-2 text-sm text-gray-500 line-clamp-3">
                                        {tool.description}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
