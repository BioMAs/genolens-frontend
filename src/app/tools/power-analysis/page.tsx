'use client';

import PowerAnalysis from '@/components/tools/PowerAnalysis';
import Link from 'next/link';
import { ArrowLeft, FlaskConical } from 'lucide-react';

export default function PowerAnalysisPage() {
    return (
        <div className="min-h-screen bg-surface-2 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/tools"
                        className="inline-flex items-center text-secondary hover:text-primary mb-4 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to tools
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-soft rounded-lg">
                            <FlaskConical className="h-7 w-7 text-accent-ink" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-primary">
                                Power Analysis
                            </h1>
                            <p className="mt-1 text-secondary">
                                Calculate the required sample size or evaluate the statistical
                                power of a test based on the expected effect, threshold α, and
                                risk β.
                            </p>
                        </div>
                    </div>
                </div>

                <PowerAnalysis />
            </div>
        </div>
    );
}
