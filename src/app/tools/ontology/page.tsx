'use client';

import GoBrowser from '@/components/tools/GoBrowser';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function OntologyPage() {
    return (
        <div className="min-h-screen bg-surface-2 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Link href="/tools" className="flex items-center text-secondary hover:text-primary mb-4">
                        <ArrowLeft className="h-4 w-4 mr-1"/> Back to Tools
                    </Link>
                    <h1 className="text-display font-bold text-primary">Gene Ontology Browser</h1>
                    <p className="mt-2 text-secondary">
                        Search and explore the Gene Ontology (GO) hierarchy. Find terms, view definitions, and navigate relationships.
                    </p>
                </div>
                
                <GoBrowser />
            </div>
        </div>
    );
}
