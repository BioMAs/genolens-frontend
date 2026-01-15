import React, { useState, useEffect } from 'react';
import api from '@/utils/api';

interface AIInterpretationPanelProps {
    datasetId: string;
    comparisonName: string;
}

interface InterpretationData {
    interpretation: string;
    cached: boolean;
    generated_at: string;
    model: string;
    summary: {
        deg_up: number;
        deg_down: number;
        top_pathways_count: number;
        top_genes_count: number;
    };
}

export default function AIInterpretationPanel({ datasetId, comparisonName }: AIInterpretationPanelProps) {
    const [data, setData] = useState<InterpretationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiStatus, setAiStatus] = useState<any>(null);
    const [expanded, setExpanded] = useState(false);
    const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);

    // Check AI availability on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await api.get('/datasets/ai/status');
                setAiStatus(response.data);
            } catch (err) {
                console.error('Failed to check AI status:', err);
            }
        };
        checkStatus();
    }, []);

    const generateInterpretation = async (forceRegenerate: boolean = false) => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/interpret`,
                null,
                {
                    params: {
                        force_regenerate: forceRegenerate,
                        language: 'fr'
                    }
                }
            );
            
            setData(response.data);
            setExpanded(true);
        } catch (err: any) {
            console.error('AI interpretation error:', err);
            setError(
                err.response?.data?.detail || 
                "Erreur lors de la génération de l'interprétation. Vérifiez qu'Ollama est démarré."
            );
        } finally {
            setLoading(false);
        }
    };

    // Remove auto-load - only manual generation
    // User must click "Générer l'interprétation" button

    if (!aiStatus) {
        return null; // Still checking status
    }

    if (!aiStatus.available) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                            IA d'interprétation non disponible
                        </h3>
                        <p className="text-sm text-yellow-700 mb-3">
                            Ollama n'est pas détecté. Pour activer l'interprétation IA locale, installez Ollama :
                        </p>
                        <div className="bg-yellow-100 rounded px-3 py-2 font-mono text-xs text-yellow-900 mb-2">
                            brew install ollama && ollama serve
                        </div>
                        <div className="bg-yellow-100 rounded px-3 py-2 font-mono text-xs text-yellow-900">
                            ollama pull biomistral
                        </div>
                        <a 
                            href="https://ollama.ai" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-yellow-700 hover:text-yellow-800 mt-3"
                        >
                            Documentation complète
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Interprétation IA Biologique</h3>
                        <p className="text-sm text-gray-600">
                            Analyse assistée par {aiStatus.current_model} • 100% locale et privée
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {data && (
                        <button
                            onClick={() => generateInterpretation(true)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-purple-300 rounded-md bg-white hover:bg-purple-50 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Régénérer
                        </button>
                    )}
                    {!data && !loading && (
                        <button
                            onClick={() => generateInterpretation(false)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-md hover:from-purple-600 hover:to-blue-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Générer l'interprétation
                        </button>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-3 text-purple-600">
                        <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm font-medium">Analyse en cours par {aiStatus.current_model}...</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Cela peut prendre 15-60 secondes</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-50 border-t border-red-200">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">Erreur</p>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                            {error.includes('mémoire') && (
                                <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                                    <strong>Solution :</strong> Augmentez la RAM de Docker à 8+ GB dans Docker Desktop → Settings → Resources → Memory
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Interpretation Content */}
            {data && !loading && (
                <div className="p-4">
                    {/* Summary Stats */}
                    {data.summary && (
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 border border-purple-100">
                                <div className="text-xs text-gray-500 mb-1">DEG UP</div>
                                <div className="text-lg font-semibold text-green-600">{data.summary.deg_up}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-100">
                                <div className="text-xs text-gray-500 mb-1">DEG DOWN</div>
                                <div className="text-lg font-semibold text-red-600">{data.summary.deg_down}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-100">
                                <div className="text-xs text-gray-500 mb-1">Pathways</div>
                                <div className="text-lg font-semibold text-blue-600">{data.summary.top_pathways_count}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-100">
                                <div className="text-xs text-gray-500 mb-1">Top Genes</div>
                                <div className="text-lg font-semibold text-purple-600">{data.summary.top_genes_count}</div>
                            </div>
                        </div>
                    )}

                    {/* Interpretation Text */}
                    <div className="bg-white rounded-lg p-6 border border-purple-100 prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                            {data.interpretation}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-purple-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            {data.cached && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Depuis le cache
                                </span>
                            )}
                            <span>Modèle: {data.model}</span>
                            <span>•</span>
                            <span>Généré: {new Date(data.generated_at).toLocaleString('fr-FR')}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            100% locale • Aucune donnée exportée
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
