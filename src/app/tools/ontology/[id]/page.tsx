'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitCommit, GitBranch, ArrowUpCircle, ArrowDownCircle, Network } from 'lucide-react';
import api from '@/utils/api';

interface GoTermDetail {
    id: string;
    name: string;
    definition: string;
    namespace: string;
    level: number;
    parents: {id: string, name: string}[];
    children: {id: string, name: string}[];
}

export default function GoTermPage() {
    const params = useParams();
    // decodeURIComponent is needed because ID might pass as "GO%3A000123"
    const termId = decodeURIComponent(params.id as string);
    const [term, setTerm] = useState<GoTermDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);

    useEffect(() => {
        if(!termId) return;
        const fetchTerm = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/ontology/term/${termId}`);
                setTerm(res.data);
            } catch (err: any) {
                setError(err.response?.data?.detail || "Failed to load term");
            } finally {
                setLoading(false);
            }
        };
        fetchTerm();
    }, [termId]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading ontology data...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!term) return null;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
             <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                 
                 <div className="mb-6">
                    <Link href="/tools" className="flex items-center text-gray-500 hover:text-gray-700 mb-4">
                        <ArrowLeft className="h-4 w-4 mr-1"/> Back to Tools
                    </Link>
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-900">{term.id}</h1>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        term.namespace === 'biological_process' ? 'bg-green-100 text-green-800' :
                                        term.namespace === 'molecular_function' ? 'bg-blue-100 text-blue-800' :
                                        'bg-purple-100 text-purple-800'
                                    }`}>
                                        {term.namespace}
                                    </span>
                                </div>
                                <h2 className="text-xl text-brand-primary mt-1">{term.name}</h2>
                                <p className="text-gray-600 mt-4 leading-relaxed bg-gray-50 p-4 rounded border border-gray-100">
                                    {term.definition}
                                </p>
                            </div>
                            <div className="text-right text-gray-400">
                                <Network className="h-10 w-10 ml-auto mb-1 opacity-20"/>
                                <span className="text-sm">Level {term.level}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Parents */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="flex items-center text-lg font-medium text-gray-900 mb-4 border-b pb-2">
                                <ArrowUpCircle className="h-5 w-5 mr-2 text-indigo-500"/>
                                Parent Terms
                            </h3>
                            {term.parents.length === 0 ? (
                                <p className="text-gray-400 italic">Root term (no parents)</p>
                            ) : (
                                <div className="space-y-3">
                                    {term.parents.map(p => (
                                        <Link 
                                            key={p.id} 
                                            href={`/tools/ontology/${encodeURIComponent(p.id)}`}
                                            className="block group"
                                        >
                                            <div className="flex items-center text-sm">
                                                <GitBranch className="h-4 w-4 text-gray-300 mr-2 rotate-180"/>
                                                <span className="font-mono text-indigo-600 group-hover:underline mr-2">{p.id}</span>
                                                <span className="text-gray-700 truncate">{p.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                         {/* Children */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="flex items-center text-lg font-medium text-gray-900 mb-4 border-b pb-2">
                                <ArrowDownCircle className="h-5 w-5 mr-2 text-teal-500"/>
                                Child Terms
                            </h3>
                            {term.children.length === 0 ? (
                                <p className="text-gray-400 italic">Leaf term (no children)</p>
                            ) : (
                                <div className="space-y-3">
                                    {term.children.map(c => (
                                        <Link 
                                            key={c.id} 
                                            href={`/tools/ontology/${encodeURIComponent(c.id)}`}
                                            className="block group"
                                        >
                                            <div className="flex items-center text-sm">
                                                <GitBranch className="h-4 w-4 text-gray-300 mr-2"/>
                                                <span className="font-mono text-teal-600 group-hover:underline mr-2">{c.id}</span>
                                                <span className="text-gray-700 truncate">{c.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
             </div>
        </div>
    );
}
