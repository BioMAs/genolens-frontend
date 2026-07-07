import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/utils/api';
import { UserProfile } from '@/types';

interface AIInterpretationPanelProps {
    datasetId: string;
    comparisonName: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
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

interface AIStatus {
    available: boolean;
    current_model: string;
}

interface ConversationItem {
    question: string;
    answer: string;
    created_at: string;
}

interface ApiError {
    response?: {
        status?: number;
        data?: {
            detail?: string;
        };
    };
}

function getApiErrorDetail(error: unknown): string | undefined {
    return (error as ApiError).response?.data?.detail;
}

export default function AIInterpretationPanel({ datasetId, comparisonName }: AIInterpretationPanelProps) {
    const [data, setData] = useState<InterpretationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'plan' | 'quota' | 'generic' | null>(null);
    const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    
    // Chat Q&A states
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [userQuestion, setUserQuestion] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [showChat, setShowChat] = useState(false);

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

    // Fetch user profile to check subscription plan
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/users/me');
                setUserProfile(response.data);
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
            }
        };
        fetchProfile();
    }, []);

    // Load conversation history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const response = await api.get(
                    `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/conversations`
                );
                
                if (response.data.conversations && response.data.conversations.length > 0) {
                    const conversations = response.data.conversations as ConversationItem[];
                    const loadedMessages: ChatMessage[] = conversations.map((conv) => [
                        {
                            role: 'user' as const,
                            content: conv.question,
                            timestamp: new Date(conv.created_at)
                        },
                        {
                            role: 'assistant' as const,
                            content: conv.answer,
                            timestamp: new Date(conv.created_at)
                        }
                    ]).flat();
                    
                    setChatMessages(loadedMessages);
                }
            } catch (err) {
                console.error('Failed to load conversation history:', err);
            }
        };
        
        if (datasetId && comparisonName) {
            loadHistory();
        }
    }, [datasetId, comparisonName]);

    // Load existing interpretation on mount — READ-ONLY (never triggers generation).
    // Generation happens only when the user clicks "Generate" (see generateInterpretation).
    useEffect(() => {
        const loadInterpretation = async () => {
            try {
                const response = await api.get(
                    `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/interpretation`
                );

                if (response.data && response.data.interpretation) {
                    setData(response.data);
                } else {
                    setData(null);
                }
            } catch (err) {
                console.error('Failed to load interpretation:', err);
            }
        };

        if (datasetId && comparisonName) {
            loadInterpretation();
        }
    }, [datasetId, comparisonName]);

    const generateInterpretation = async (forceRegenerate: boolean = false) => {
        setLoading(true);
        setError(null);
        setErrorType(null);

        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/interpret`,
                null,
                {
                    params: {
                        force_regenerate: forceRegenerate,
                        language: 'en'
                    }
                }
            );

            setData(response.data);
        } catch (err: unknown) {
            console.error('AI interpretation error:', err);
            const status = (err as ApiError).response?.status;

            if (status === 403) {
                setError("AI interpretation requires a Pro or Advanced plan.");
                setErrorType('plan');
            } else if (status === 402) {
                setError("You've used all your AI interpretations for this month.");
                setErrorType('quota');
            } else {
                setError(
                    getApiErrorDetail(err) ||
                    "Error generating interpretation. The AI service may be starting up — please try again."
                );
                setErrorType('generic');
            }
        } finally {
            setLoading(false);
        }
    };

    const askQuestion = async () => {
        if (!userQuestion.trim()) return;
        
        const newUserMessage: ChatMessage = {
            role: 'user',
            content: userQuestion,
            timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, newUserMessage]);
        setUserQuestion('');
        setChatLoading(true);
        
        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/ask`,
                {
                    question: newUserMessage.content,
                    context: data?.interpretation || ''
                }
            );
            
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.data.answer,
                timestamp: new Date()
            };
            
            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (err: unknown) {
            console.error('AI chat error:', err);
            const status = (err as ApiError).response?.status;
            
            let errorMsg = "Sorry, I couldn't answer your question. The AI service may be starting up — please try again.";
            
            if (status === 403) {
                errorMsg = "AI interpretation requires a Pro or Advanced plan. Visit /pricing to upgrade.";
            } else if (status === 402) {
                errorMsg = "You've used all your AI interpretations for this month. Visit /pricing to upgrade or /profile to buy more tokens.";
            } else if (getApiErrorDetail(err)) {
                errorMsg = getApiErrorDetail(err) as string;
            }

            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: errorMsg,
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setChatLoading(false);
        }
    };

    if (!aiStatus || !userProfile) {
        return null;
    }

    // Show upgrade notice for BASIC users
    if (userProfile.subscription_plan === 'BASIC' && userProfile.role !== 'ADMIN') {
        return (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-4 p-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            AI Biological Interpretation
                        </h3>
                        <p className="text-sm text-gray-700 mb-4">
                            Get instant AI-powered insights and biological interpretation of your differential expression results. 
                            This feature uses advanced language models to analyze your data and provide meaningful scientific explanations.
                        </p>
                        
                        <div className="bg-white border border-purple-200 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Available with PREMIUM or ADVANCED plans:
                            </h4>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Automated biological interpretation of DEG results</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Interactive Q&A about your analysis results</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Pathway enrichment insights and gene function summaries</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Powered by Gemma 4, a state-of-the-art open model</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 shadow-sm transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                View Plans →
                            </Link>
                            <span className="text-xs text-gray-500">
                                Starting at $29/month
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                            AI interpretation temporarily unavailable
                        </h3>
                        <p className="text-sm text-yellow-700">
                            The AI service is currently unreachable. This is usually transient —
                            please try again in a moment. If it persists, contact support.
                        </p>
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
                        <h3 className="text-lg font-semibold text-gray-900">AI Biological Interpretation</h3>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {data && (
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-purple-300 rounded-md bg-white hover:bg-purple-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {showChat ? 'Hide Q&A' : 'Ask a Question'}
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
                            Generate Interpretation
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
                        <span className="text-sm font-medium">Analysis in progress by {aiStatus.current_model}...</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">This can take up to a few minutes on the first run</p>
                </div>
            )}

            {/* Error State */}
            {error && errorType === 'plan' && (
                <div className="p-4 bg-purple-50 border-t border-purple-200">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-purple-900">Plan Required</p>
                            <p className="text-sm text-purple-800 mt-1">{error}</p>
                            <div className="mt-3">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    View Plans →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {error && errorType === 'quota' && (
                <div className="p-4 bg-amber-50 border-t border-amber-200">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900">Monthly Quota Reached</p>
                            <p className="text-sm text-amber-800 mt-1">{error}</p>
                            <p className="text-sm text-amber-700 mt-0.5">Purchase more tokens or upgrade your plan.</p>
                            <div className="mt-3 flex items-center gap-2">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Upgrade Plan
                                </Link>
                                <Link
                                    href="/profile#billing"
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                                >
                                    Buy More Tokens
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {error && errorType === 'generic' && (
                <div className="p-4 bg-red-50 border-t border-red-200">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">Error</p>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                            {error.includes('memory') && (
                                <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                                    <strong>Solution:</strong> Increase Docker RAM to 8+ GB in Docker Desktop → Settings → Resources → Memory
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Interpretation Content */}
            {data && !loading && (
                <div className="p-4">
                    {/* Interpretation Text */}
                    <div className="bg-white rounded-lg p-6 border border-purple-100 prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                            {data.interpretation}
                        </div>
                    </div>

                    {/* Chat Q&A Section */}
                    {showChat && (
                        <div className="mt-4 bg-white rounded-lg border border-purple-100">
                            <div className="border-b border-purple-100 p-3 bg-gradient-to-r from-purple-50 to-blue-50">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Questions & Answers
                                </h4>
                                <p className="text-xs text-gray-600 mt-1">Ask your questions about this analysis</p>
                            </div>
                            
                            {/* Chat Messages */}
                            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                                {chatMessages.length === 0 && (
                                    <div className="text-center text-sm text-gray-500 py-8">
                                        <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        Ask your first question below
                                    </div>
                                )}
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-lg p-3 ${
                                            msg.role === 'user' 
                                                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                                                : 'bg-gray-100 text-gray-900'
                                        }`}>
                                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                                            <div className={`text-xs mt-1 ${
                                                msg.role === 'user' ? 'text-purple-100' : 'text-gray-500'
                                            }`}>
                                                {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                AI is thinking...
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Input */}
                            <div className="border-t border-purple-100 p-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={userQuestion}
                                        onChange={(e) => setUserQuestion(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !chatLoading && askQuestion()}
                                        placeholder="Ask your question (e.g., What are the most important genes?)"
                                        disabled={chatLoading}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm disabled:bg-gray-50"
                                    />
                                    <button
                                        onClick={askQuestion}
                                        disabled={!userQuestion.trim() || chatLoading}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-purple-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            {data.cached && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    From cache
                                </span>
                            )}
                            <span>Model: {data.model}</span>
                            <span>•</span>
                            <span>Generated: {new Date(data.generated_at).toLocaleString('en-US')}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-purple-600">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Powered by Gemma 4
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
