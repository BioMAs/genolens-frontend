'use client';

import PowerAnalysis from '@/components/tools/PowerAnalysis';
import Link from 'next/link';
import { ArrowLeft, FlaskConical } from 'lucide-react';

export default function PowerAnalysisPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/tools"
                        className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-4 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Retour aux outils
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <FlaskConical className="h-7 w-7 text-purple-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Analyse de puissance
                            </h1>
                            <p className="mt-1 text-gray-600">
                                Calculez la taille d&apos;échantillon requise ou évaluez la puissance
                                statistique d&apos;un test selon l&apos;effet attendu, le seuil α et le
                                risque β.
                            </p>
                        </div>
                    </div>
                </div>

                <PowerAnalysis />
            </div>
        </div>
    );
}
