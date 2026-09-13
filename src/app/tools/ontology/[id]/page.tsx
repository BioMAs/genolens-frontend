'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { GitBranch, ArrowUpCircle, ArrowDownCircle, Network } from 'lucide-react';
import api from '@/utils/api';
import { PageHeader } from '@/components/ui/page-header';

interface GoTermDetail {
    id: string;
    name: string;
    definition: string;
    namespace: string;
    level: number;
    parents: {id: string, name: string}[];
    children: {id: string, name: string}[];
}

interface ApiErrorShape {
    response?: {
        data?: {
            detail?: unknown;
        };
    };
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
            } catch (err: unknown) {
                const detail = (err as ApiErrorShape)?.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : 'Failed to load term');
            } finally {
                setLoading(false);
            }
        };
        fetchTerm();
    }, [termId]);

    if (loading) return <div className="p-8 text-center text-secondary">Loading ontology data...</div>;
    if (error) return <div className="p-8 text-center text-danger-ink">{error}</div>;
    if (!term) return null;

    return (
        <div className="page-container">
                 <div className="mb-6">
                    {/* Le titre de l'ecran etait enferme dans une carte, et
                        l'identifiant GO y passait AVANT le nom du terme — donc
                        le `<h1>` disait « GO:0006915 » et un `<h2>` disait
                        « apoptotic process ». C'est le nom qui identifie le
                        terme pour un lecteur ; l'identifiant est une reference.

                        Les pastilles d'espace de noms employaient `bg-green-100
                        text-green-800` et `bg-blue-100 text-blue-800` — de la
                        palette Tailwind brute, et du VERT, qui dans ce produit
                        signifie « sur-exprime ». Elles passent sur le fond
                        d'accent, neutre. */}
                    <PageHeader
                        eyebrow={term.id}
                        title={term.name}
                        titleVariant="name"
                        description={term.definition}
                        crumbs={[
                            { label: 'Tools', href: '/tools' },
                            { label: 'Gene Ontology', href: '/tools/ontology' },
                            { label: term.id },
                        ]}
                        meta={
                            <>
                                <span className="rounded-pill bg-accent-soft px-2 py-1 text-caption font-medium text-accent-ink">
                                    {term.namespace}
                                </span>
                                <span className="inline-flex items-center gap-2 text-body-sm text-muted">
                                    <Network className="h-4 w-4" /> Level {term.level}
                                </span>
                            </>
                        }
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Parents */}
                        <div className="bg-surface rounded-card shadow-sm p-6">
                            <h3 className="flex items-center text-title font-medium text-primary mb-4 border-b pb-2">
                                <ArrowUpCircle className="h-5 w-5 mr-2 text-accent-ink"/>
                                Parent Terms
                            </h3>
                            {term.parents.length === 0 ? (
                                <p className="text-muted italic">Root term (no parents)</p>
                            ) : (
                                <div className="space-y-3">
                                    {term.parents.map(p => (
                                        <Link 
                                            key={p.id} 
                                            href={`/tools/ontology/${encodeURIComponent(p.id)}`}
                                            className="block group"
                                        >
                                            <div className="flex items-center text-body-sm">
                                                <GitBranch className="h-4 w-4 text-gray-300 mr-2 rotate-180"/>
                                                <span className="font-mono text-accent-ink group-hover:underline mr-2">{p.id}</span>
                                                <span className="text-primary truncate">{p.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                         {/* Children */}
                        <div className="bg-surface rounded-card shadow-sm p-6">
                            <h3 className="flex items-center text-title font-medium text-primary mb-4 border-b pb-2">
                                <ArrowDownCircle className="h-5 w-5 mr-2 text-teal-500"/>
                                Child Terms
                            </h3>
                            {term.children.length === 0 ? (
                                <p className="text-muted italic">Leaf term (no children)</p>
                            ) : (
                                <div className="space-y-3">
                                    {term.children.map(c => (
                                        <Link 
                                            key={c.id} 
                                            href={`/tools/ontology/${encodeURIComponent(c.id)}`}
                                            className="block group"
                                        >
                                            <div className="flex items-center text-body-sm">
                                                <GitBranch className="h-4 w-4 text-gray-300 mr-2"/>
                                                <span className="font-mono text-teal-600 group-hover:underline mr-2">{c.id}</span>
                                                <span className="text-primary truncate">{c.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
        </div>
    );
}
