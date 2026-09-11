'use client';

import PowerAnalysis from '@/components/tools/PowerAnalysis';
import { FlaskConical } from 'lucide-react';

export default function PowerAnalysisPage() {
    return (
        <div className="py-8">
            <div className="page-container">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-soft rounded-control">
                            <FlaskConical className="h-7 w-7 text-accent-ink" />
                        </div>
                        <div>
                            <h1 className="text-display text-primary">
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
