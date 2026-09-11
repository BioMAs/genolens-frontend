'use client';

import { Suspense } from 'react';
import { Target } from 'lucide-react';

import DrugDiscovery from '@/components/tools/DrugDiscovery';

export default function DrugDiscoveryPage() {
    return (
        <div className="py-8">
            <div className="page-container">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 rounded-lg">
                            <Target className="h-7 w-7 text-rose-700" />
                        </div>
                        <div>
                            <h1 className="text-display text-primary">Drug Discovery</h1>
                            {/* La phrase précédente disait « The module does not read any of your
                                data ». Elle est devenue fausse le jour où le mode B a été câblé :
                                l'onglet « Drug targets » d'une comparaison envoie les symboles des
                                gènes différentiels au service. Une mention de confidentialité
                                périmée coûte plus que l'absence de mention. */}
                            <p className="mt-1 text-secondary">
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
                <Suspense fallback={<p className="text-body-sm text-secondary">Loading…</p>}>
                    <DrugDiscovery />
                </Suspense>
            </div>
        </div>
    );
}
