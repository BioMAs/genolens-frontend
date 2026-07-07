'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Send, Sparkles, Wrench } from 'lucide-react';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { useDatasetComparisons } from '@/hooks/useComparisons';
import { useChatAgent } from '@/hooks/useChatAgent';
import { DatasetType } from '@/types';
import ChatFigure from '@/components/chat/ChatFigure';

/**
 * Full-screen ChatGPT-style assistant. Rendered by AppFrame when chat mode is on.
 * The user first selects a project → DEG dataset → comparison, then converses; the
 * agent can answer questions and generate figures inline.
 */
export default function ChatModeShell() {
  const { setChatMode } = useChatMode();
  const [projectId, setProjectId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [comparisonName, setComparisonName] = useState('');

  const { data: projectsResp } = useProjects({ page_size: 100 });
  const projects = projectsResp?.items ?? [];
  const { data: datasets } = useProjectDatasets(projectId);
  const degDatasets = (datasets ?? []).filter((d) => d.type === DatasetType.DEG);
  const { data: comparisons } = useDatasetComparisons(datasetId, !!datasetId);

  const contextReady = !!projectId && !!datasetId && !!comparisonName;

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-base,var(--surface))]">
      {/* Header */}
      <header className="flex h-[var(--topbar-height,52px)] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="GenoLens" width={110} height={34} className="h-7 w-auto" />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--sl-purple)]" /> Assistant
          </span>
        </div>
        <button
          onClick={() => setChatMode(false)}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Full interface
        </button>
      </header>

      {/* Context selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <Selector
          label="Project"
          value={projectId}
          onChange={(v) => {
            setProjectId(v);
            setDatasetId('');
            setComparisonName('');
          }}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Selector
          label="Dataset"
          value={datasetId}
          disabled={!projectId}
          onChange={(v) => {
            setDatasetId(v);
            setComparisonName('');
          }}
          options={degDatasets.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Selector
          label="Comparison"
          value={comparisonName}
          disabled={!datasetId}
          onChange={setComparisonName}
          options={(comparisons ?? []).map((c) => ({ value: c.name, label: c.name }))}
        />
      </div>

      {/* Conversation (remounts on context change to start a fresh session) */}
      {contextReady ? (
        <ChatConversation
          key={`${datasetId}::${comparisonName}`}
          projectId={projectId}
          datasetId={datasetId}
          comparisonName={comparisonName}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--text-muted)]">
          Select a project, a DEG dataset and a comparison to start chatting.
        </div>
      )}
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
                <ChatFigure key={fig.call_id} figure={fig} />
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
