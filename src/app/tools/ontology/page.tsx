'use client';

import GoBrowser from '@/components/tools/GoBrowser';

export default function OntologyPage() {
    return (
        <div className="py-8">
            <div className="page-container">
                <div className="mb-6">
                    <h1 className="text-display text-primary">Gene Ontology Browser</h1>
                    <p className="mt-2 text-secondary">
                        Search and explore the Gene Ontology (GO) hierarchy. Find terms, view definitions, and navigate relationships.
                    </p>
                </div>
                
                <GoBrowser />
            </div>
        </div>
    );
}
