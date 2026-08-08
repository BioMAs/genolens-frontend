'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, Target } from 'lucide-react';

import DrugDiscovery from '@/components/tools/DrugDiscovery';

export default function DrugDiscoveryPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Link
                        href="/tools"
                        className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-4 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to tools
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 rounded-lg">
                            <Target className="h-7 w-7 text-rose-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Drug Discovery</h1>
                            {/* La phrase précédente disait « The module does not read any of your
                                data ». Elle est devenue fausse le jour où le mode B a été câblé :
                                l'onglet « Drug targets » d'une comparaison envoie les symboles des
                                gènes différentiels au service. Une mention de confidentialité
                                périmée coûte plus que l'absence de mention. */}
                            <p className="mt-1 text-gray-600">
                                Ranking of therapeutic targets across 33 TCGA indications, from
                                curated public sources. This page ranks public data only — to
                                confront your own differential-expression comparison with a
                                ranking, open the <strong>Drug targets</strong> tab on that
                                comparison.
                            </p>
                        </div>
                    </div>
                </div>

                {/* useSearchParams impose une frontière Suspense en App Router. */}
                <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
                    <DrugDiscovery />
                </Suspense>
            </div>
        </div>
    );
}
