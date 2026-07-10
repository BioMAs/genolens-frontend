import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles,
    MessageCircle,
    Zap,
    Send,
    Loader2,
    AlertTriangle,
    Database,
    CheckCircle2,
    Check,
} from 'lucide-react';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import AIMarkdown from '@/components/ui/AIMarkdown';

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
        const perks = [
            'Automated biological interpretation of DEG results',
            'Interactive Q&A about your analysis results',
            'Pathway enrichment insights and gene function summaries',
            'Powered by Gemma 4, a state-of-the-art open model',
        ];
        return (
            <div className="gl-card">
                <div className="flex items-start gap-4 p-6">
                    <div
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' }}
                    >
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            AI Biological Interpretation
                        </h3>
                        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Get instant AI-powered insights and biological interpretation of your differential expression results.
                            This feature uses advanced language models to analyze your data and provide meaningful scientific explanations.
                        </p>

                        <div
                            className="mb-4 rounded-xl border p-4"
                            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                        >
                            <h4
                                className="mb-2 flex items-center gap-2 text-sm font-semibold"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--sl-purple)' }} />
                                Available with PREMIUM or ADVANCED plans:
                            </h4>
                            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {perks.map((perk) => (
                                    <li key={perk} className="flex items-start gap-2">
                                        <Check
                                            className="mt-0.5 h-4 w-4 flex-shrink-0"
                                            style={{ color: 'var(--sl-teal)' }}
                                        />
                                        <span>{perk}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/pricing"
                                className="inline-flex items-center gap-2 rounded-[11px] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
                                style={{ background: 'var(--sl-purple)' }}
                            >
                                <Zap className="h-4 w-4" />
                                View Plans →
                            </Link>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
            <div
                className="rounded-[14px] border p-4"
                style={{ background: 'var(--sl-amber-light, rgba(245,158,11,0.10))', borderColor: 'rgba(245,158,11,0.35)' }}
            >
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <div className="flex-1">
                        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            AI interpretation temporarily unavailable
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            The AI service is currently unreachable. This is usually transient —
                            please try again in a moment. If it persists, contact support.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="gl-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' }}
                    >
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                        AI Biological Interpretation
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    {data && (
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className="inline-flex items-center gap-2 rounded-[11px] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--hover-overlay)]"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        >
                            <MessageCircle className="h-4 w-4" />
                            {showChat ? 'Hide Q&A' : 'Ask a Question'}
                        </button>
                    )}
                    {!data && !loading && (
                        <button
                            onClick={() => generateInterpretation(false)}
                            className="inline-flex items-center gap-2 rounded-[11px] px-4 py-2 text-sm font-medium text-white transition-colors"
                            style={{ background: 'var(--sl-purple)' }}
                        >
                            <Sparkles className="h-4 w-4" />
                            Generate Interpretation
                        </button>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-3" style={{ color: 'var(--sl-purple)' }}>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm font-medium">Analysis in progress by {aiStatus.current_model}...</span>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        This can take up to a few minutes on the first run
                    </p>
                </div>
            )}

            {/* Error State */}
            {error && errorType === 'plan' && (
                <div className="border-t p-4" style={{ background: 'var(--sl-purple-light)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: 'var(--sl-purple)' }} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--sl-purple-dark)' }}>Plan Required</p>
                            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                            <div className="mt-3">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center gap-1 rounded-[11px] px-4 py-2 text-sm font-semibold text-white transition-colors"
                                    style={{ background: 'var(--sl-purple)' }}
                                >
                                    View Plans →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {error && errorType === 'quota' && (
                <div className="border-t p-4" style={{ background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.35)' }}>
                    <div className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Quota Reached</p>
                            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>Purchase more tokens or upgrade your plan.</p>
                            <div className="mt-3 flex items-center gap-2">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center gap-1 rounded-[11px] px-4 py-2 text-sm font-semibold text-white transition-colors"
                                    style={{ background: 'var(--sl-purple)' }}
                                >
                                    Upgrade Plan
                                </Link>
                                <Link
                                    href="/profile#billing"
                                    className="inline-flex items-center gap-1 rounded-[11px] border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--hover-overlay)]"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                >
                                    Buy More Tokens
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {error && errorType === 'generic' && (
                <div className="border-t p-4" style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }}>
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: 'var(--sl-red)' }} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--sl-red-dark)' }}>Error</p>
                            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                            {error.includes('memory') && (
                                <div
                                    className="mt-2 rounded-lg p-2 text-xs"
                                    style={{ background: 'var(--sl-red-light)', color: 'var(--sl-red-dark)' }}
                                >
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
                    <div
                        className="rounded-xl border p-6"
                        style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                    >
                        <AIMarkdown text={data.interpretation} />
                    </div>

                    {/* Chat Q&A Section */}
                    {showChat && (
                        <div
                            className="mt-4 rounded-xl border"
                            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                            <div
                                className="border-b p-3"
                                style={{ background: 'var(--sl-purple-light)', borderColor: 'var(--border)' }}
                            >
                                <h4 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    <MessageCircle className="h-4 w-4" style={{ color: 'var(--sl-purple)' }} />
                                    Questions & Answers
                                </h4>
                                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Ask your questions about this analysis</p>
                            </div>

                            {/* Chat Messages */}
                            <div className="max-h-96 space-y-3 overflow-y-auto p-4">
                                {chatMessages.length === 0 && (
                                    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <MessageCircle className="mx-auto mb-2 h-12 w-12" style={{ color: 'var(--border-strong)' }} />
                                        Ask your first question below
                                    </div>
                                )}
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'user' ? (
                                            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-white" style={{ background: 'var(--sl-purple)' }}>
                                                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                                <div className="mt-1 text-xs text-white/70">
                                                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="max-w-[80%] rounded-2xl px-4 py-2"
                                                style={{ background: 'var(--surface-raised)' }}
                                            >
                                                <AIMarkdown text={msg.content} />
                                                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex justify-start">
                                        <div className="rounded-2xl px-4 py-2" style={{ background: 'var(--surface-raised)' }}>
                                            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="animate-pulse">AI is thinking…</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={userQuestion}
                                        onChange={(e) => setUserQuestion(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !chatLoading && askQuestion()}
                                        placeholder="Ask your question (e.g., What are the most important genes?)"
                                        disabled={chatLoading}
                                        className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sl-purple)] disabled:opacity-50"
                                        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    />
                                    <button
                                        onClick={askQuestion}
                                        disabled={!userQuestion.trim() || chatLoading}
                                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ background: 'var(--sl-purple)' }}
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {data.cached && (
                                <span
                                    className="inline-flex items-center gap-1 rounded px-2 py-1"
                                    style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                                >
                                    <Database className="h-3 w-3" />
                                    From cache
                                </span>
                            )}
                            <span>Model: {data.model}</span>
                            <span>•</span>
                            <span>Generated: {new Date(data.generated_at).toLocaleString('en-US')}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--sl-purple)' }}>
                            <Sparkles className="h-3 w-3" />
                            Powered by Gemma 4
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
