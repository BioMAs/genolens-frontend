'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import api from '@/utils/api';
import { useChartAI, ChartType } from '@/hooks/useChartAI';
import { UserProfile } from '@/types';

interface AIChartAssistantProps {
  datasetId: string;
  chartType: ChartType;
  contextKey: string;
  context: Record<string, unknown>;
  label?: string;
  panelClassName?: string;
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
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-4 p-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">AI Chart Assistant</h3>
              <p className="text-xs text-gray-600 mb-3">
                Get AI-powered insights for this chart. Available with PREMIUM or ADVANCED plans.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-md hover:from-purple-600 hover:to-blue-600 shadow-sm transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  View Plans →
                </Link>
                <span className="text-xs text-gray-400">Starting at $29/month</span>
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
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
      >
        <span>✨</span>
        <span>Ask AI</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-3 border border-purple-200 rounded-lg bg-white overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[9px] font-bold">
                AI
              </div>
              <span className="text-sm font-semibold text-gray-700">AI Assistant</span>
              {label && (
                <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                  {label}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className={`${panelClassName ?? 'max-h-72'} overflow-y-auto p-4 flex flex-col gap-3`}>
            {!interpretation && !isInterpreting && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-xs text-gray-500">Get an AI reading of this chart.</p>
                <button
                  onClick={() => interpret()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-md hover:from-purple-600 hover:to-blue-600 shadow-sm transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Interpret this chart
                </button>
              </div>
            )}
            {isInterpreting && !interpretation && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center text-white text-[8px]">
                  AI
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 animate-pulse">
                  Analyzing chart...
                </div>
              </div>
            )}
            {interpretation && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center text-white text-[8px]">
                  AI
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
                  {interpretation}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center text-white text-[8px]">
                    AI
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-gray-50 border border-gray-100 text-gray-700 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center text-white text-[8px]">
                  AI
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              disabled={isAsking || isInterpreting}
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || isAsking || isInterpreting}
              className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
