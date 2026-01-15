'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Network, Search, ArrowRight, ChevronRight, GitBranch } from 'lucide-react';
import api from '@/utils/api';

interface GoTerm {
    id: string; // GO:1234
    name: string; // Definition
    database: string;
}

export default function GoBrowser() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GoTerm[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (val: string) => {
        setQuery(val);
        if (val.length < 2) {
            setResults([]);
            return;
        }

        try {
            setLoading(true);
            const res = await api.get(`/ontology/search`, { params: { q: val } });
            setResults(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
                <Network className="h-6 w-6 text-brand-primary" />
                <h2 className="text-xl font-semibold text-gray-900">Gene Ontology Browser</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
                Search and explore the Gene Ontology hierarchy. Visualize parent/child relationships.
            </p>

            <div className="relative max-w-xl">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    placeholder="Search GO Terms (e.g. mitochondrion, GO:0005739)"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                />
            </div>

            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {results.map(term => (
                    <Link 
                        key={term.id} 
                        href={`/tools/ontology/${encodeURIComponent(term.id)}`}
                        className="block p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-medium text-brand-primary">{term.id}</h3>
                                <p className="text-gray-800">{term.name}</p>
                            </div>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {term.database}
                            </span>
                        </div>
                    </Link>
                ))}
                
                {query.length > 1 && results.length === 0 && !loading && (
                    <p className="text-gray-500 text-sm">No terms found.</p>
                )}
            </div>
        </div>
    );
}
