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
                            <p className="mt-1 text-gray-600">
                                Classement de cibles thérapeutiques sur 33 indications TCGA, à
                                partir de sources publiques curées. Le module ne lit aucune de vos
                                données.
                            </p>
                        </div>
                    </div>
                </div>

                {/* useSearchParams impose une frontière Suspense en App Router. */}
                <Suspense fallback={<p className="text-sm text-gray-500">Chargement…</p>}>
                    <DrugDiscovery />
                </Suspense>
            </div>
        </div>
    );
}
