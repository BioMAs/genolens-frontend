'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import api from '@/utils/api';
import { useChartAI, ChartType } from '@/hooks/useChartAI';
import { UserProfile } from '@/types';
import AIMarkdown from '@/components/ui/AIMarkdown';

interface AIChartAssistantProps {
  datasetId: string;
  chartType: ChartType;
  contextKey: string;
  context: Record<string, unknown>;
  label?: string;
  panelClassName?: string;
}

/** Small circular AI avatar with a Sparkles glyph. */
function AIAvatar({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' }}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </div>
  );
}

export default function AIChartAssistant({
  datasetId,
  chartType,
  contextKey,
  context,
  label,
  panelClassName,
}: AIChartAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { interpretation, messages, isInterpreting, isAsking, interpret, ask } = useChartAI({
    datasetId,
    chartType,
    contextKey,
    context,
    enabled: open,
  });

  // Fetch user profile to check subscription plan (same pattern as AIInterpretationPanel)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/users/me');
        setUserProfile(response.data);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        setProfileLoaded(true);
      }
    };
    fetchProfile();
  }, []);

  // No auto-interpretation: generation must be triggered explicitly by the user
  // (button below) so opening the panel never launches an AI call on its own.

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interpretation]);

  const handleAsk = async () => {
    if (!question.trim() || isAsking) return;
    const q = question.trim();
    setQuestion('');
    await ask(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  // Don't render until profile is loaded
  if (!profileLoaded) {
    return null;
  }

  // Show upgrade notice for BASIC users (same gating as AIInterpretationPanel)
  if (userProfile?.subscription_plan === 'BASIC' && userProfile?.role !== 'ADMIN') {
    return (
      <div className="w-full">
        <div className="gl-card">
          <div className="flex items-start gap-4 p-4">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Chart Assistant</h3>
              <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Get AI-powered insights for this chart. Available with PREMIUM or ADVANCED plans.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                  style={{ background: 'var(--sl-purple)' }}
                >
                  <Sparkles className="h-3 w-3" />
                  View Plans →
                </Link>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Starting at $29/month</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-[11px] border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--hover-overlay)]"
        style={{ background: 'var(--sl-purple-light)', borderColor: 'var(--border)', color: 'var(--sl-purple)' }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Ask AI</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          className="mt-3 overflow-hidden rounded-[14px] border shadow-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ background: 'var(--sl-purple-light)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <AIAvatar className="h-5 w-5" />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Assistant</span>
              {label && (
                <span
                  className="rounded border px-1.5 py-0.5 text-xs"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {label}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className={`${panelClassName ?? 'max-h-72'} flex flex-col gap-3 overflow-y-auto p-4`}>
            {!interpretation && !isInterpreting && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Get an AI reading of this chart.</p>
                <button
                  onClick={() => interpret()}
                  className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                  style={{ background: 'var(--sl-purple)' }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Interpret this chart
                </button>
              </div>
            )}
            {isInterpreting && !interpretation && (
              <div className="flex gap-2">
                <AIAvatar />
                <div
                  className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="animate-pulse">Analyzing chart…</span>
                </div>
              </div>
            )}
            {interpretation && (
              <div className="flex gap-2">
                <AIAvatar />
                <div className="max-w-[85%] rounded-2xl px-3 py-2" style={{ background: 'var(--surface-raised)' }}>
                  <AIMarkdown text={interpretation} />
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && <AIAvatar />}
                {msg.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed text-white"
                    style={{ background: 'var(--sl-purple)' }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2"
                    style={{ background: 'var(--surface-raised)' }}
                  >
                    <AIMarkdown text={msg.content} />
                  </div>
                )}
              </div>
            ))}

            {isAsking && (
              <div className="flex gap-2">
                <AIAvatar />
                <div
                  className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 border-t px-4 pb-4 pt-2" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              disabled={isAsking || isInterpreting}
              className="flex-1 rounded-xl border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sl-purple)] disabled:opacity-50"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || isAsking || isInterpreting}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--sl-purple)' }}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
