'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, HelpCircle, Send, Sparkles, Wrench } from 'lucide-react';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useChatAgent } from '@/hooks/useChatAgent';
import PlotlyFigure from '@/components/chat/PlotlyFigure';
import HelpPanel from '@/components/chat/HelpPanel';

/**
 * Full-screen assistant. Rendered by AppFrame when chat mode is on. Entry is always
 * scoped to a single comparison, passed via `initialContext` from the comparison-page
 * "AI Assistant" button — there is no in-chat project/dataset/comparison selector.
 */
export default function ChatModeShell() {
  const { setChatMode, initialContext } = useChatMode();
  const [helpOpen, setHelpOpen] = useState(false);

  const contextReady =
    !!initialContext?.projectId && !!initialContext?.datasetId && !!initialContext?.comparisonName;

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-base,var(--surface))]">
      {/* Minimal top bar */}
      <header className="flex h-[var(--topbar-height,52px)] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="GenoLens" width={110} height={34} className="h-7 w-auto" />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--sl-purple)]" /> AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--hover-overlay)] ${
              helpOpen ? 'text-[var(--sl-purple)]' : 'text-[var(--text-primary)]'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </button>
          <button
            onClick={() => setChatMode(false)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Full interface
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {contextReady ? (
            <ChatConversation
              key={`${initialContext!.datasetId}::${initialContext!.comparisonName}`}
              projectId={initialContext!.projectId}
              datasetId={initialContext!.datasetId}
              comparisonName={initialContext!.comparisonName as string}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--text-muted)]">
              Open the AI Assistant from a comparison to start chatting.
            </div>
          )}
        </div>
        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      </div>
    </div>
  );
}

function ChatConversation({
  projectId,
  datasetId,
  comparisonName,
}: {
  projectId: string;
  datasetId: string;
  comparisonName: string;
}) {
  const { messages, isStreaming, error, send } = useChatAgent({
    projectId,
    datasetId,
    comparisonName,
  });
  const [input, setInput] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    void send(text);
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-[var(--text-muted)]">
            Ask about “{comparisonName}” — e.g. “How many genes are up-regulated?” or
            “Show me a volcano plot”.
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="self-end rounded-2xl bg-[var(--sl-purple)] px-4 py-2 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-2">
              {(m.toolCalls ?? []).map((tc, j) => (
                <div key={j} className="flex w-fit items-center gap-1.5 rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                  <Wrench className="h-3 w-3" /> {tc.tool}
                </div>
              ))}
              {(m.figures ?? []).map((fig) => (
                <PlotlyFigure key={fig.call_id} figure={fig} comparisonName={comparisonName} />
              ))}
              {m.content && (
                <div className="whitespace-pre-wrap rounded-2xl bg-[var(--surface-raised)] px-4 py-2 text-sm text-[var(--text-primary)]">
                  {m.content}
                </div>
              )}
              {m.pending && !m.content && (
                <div className="w-fit rounded-2xl bg-[var(--surface-raised)] px-4 py-2 text-sm text-[var(--text-muted)]">
                  <span className="animate-pulse">
                    {m.status === 'calling_tool'
                      ? 'Running analysis…'
                      : m.status === 'generating'
                        ? 'Writing…'
                        : 'Thinking…'}
                  </span>
                </div>
              )}
            </div>
          ),
        )}
        {error && (
          <div className="rounded-lg border border-[var(--sl-red)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--sl-red)]">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-[var(--border)] px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={1}
            placeholder="Ask a question or request a figure…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--sl-purple)]"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--sl-purple)] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </>
  );
}
