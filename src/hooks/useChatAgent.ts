'use client';

import { useCallback, useRef, useState } from 'react';
import api from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

/** A Plotly figure spec built server-side from the constrained chart request. */
export interface PlotlySpec {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
}

export interface ChatFigureData {
  call_id: string;
  figure_type: string;
  params: Record<string, unknown>;
  /** Plotly {data, layout} — merged with real data server-side. */
  spec: PlotlySpec;
}

export interface ChatToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  figures?: ChatFigureData[];
  toolCalls?: ChatToolCall[];
  pending?: boolean;
  status?: string | null;
}

interface SessionContext {
  projectId: string;
  datasetId: string;
  comparisonName?: string | null;
}

/** Named-SSE reader: yields {event, data} frames (extends the readSSE pattern). */
async function* readNamedSSE(
  url: string,
  body: Record<string, unknown>,
  token?: string,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Chat request failed: ${response.status}${detail ? ` – ${detail}` : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      let event = 'message';
      let dataStr = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        yield { event, data: JSON.parse(dataStr) };
      } catch {
        // ignore malformed frame
      }
    }
  }
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '/api/v2').replace(/\/$/, '');
}

/**
 * Drives an agentic chat session: creates the session lazily, streams each turn,
 * and accumulates narrative text + inline figures per assistant message.
 */
export function useChatAgent(ctx: SessionContext) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const resp = await api.post('/chat/sessions', {
      project_id: ctx.projectId,
      dataset_id: ctx.datasetId,
      comparison_name: ctx.comparisonName ?? null,
    });
    sessionIdRef.current = resp.data.id as string;
    return sessionIdRef.current;
  }, [ctx.projectId, ctx.datasetId, ctx.comparisonName]);

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      setError(null);
      setIsStreaming(true);

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: '', figures: [], toolCalls: [], pending: true, status: 'thinking' },
      ]);

      // Helper to mutate the last (assistant) message immutably.
      const patchAssistant = (patch: (m: AgentMessage) => AgentMessage) =>
        setMessages((prev) => {
          const next = [...prev];
          const i = next.length - 1;
          if (i >= 0 && next[i].role === 'assistant') next[i] = patch(next[i]);
          return next;
        });

      try {
        const sessionId = await ensureSession();
        const { data: { session } } = await createClient().auth.getSession();
        const token = session?.access_token;
        const url = `${apiBase()}/chat/sessions/${sessionId}/message`;

        for await (const { event, data } of readNamedSSE(url, { message: trimmed }, token)) {
          if (event === 'status') {
            patchAssistant((m) => ({ ...m, status: (data.phase as string) ?? m.status }));
          } else if (event === 'tool_call') {
            patchAssistant((m) => ({
              ...m,
              toolCalls: [...(m.toolCalls ?? []), { tool: data.tool as string, args: (data.args as Record<string, unknown>) ?? {} }],
            }));
          } else if (event === 'figure') {
            patchAssistant((m) => ({
              ...m,
              figures: [...(m.figures ?? []), data as unknown as ChatFigureData],
            }));
          } else if (event === 'token') {
            patchAssistant((m) => ({ ...m, content: m.content + (data.text as string) }));
          } else if (event === 'error') {
            if (!data.recoverable) setError((data.message as string) ?? 'An error occurred');
          } else if (event === 'done') {
            patchAssistant((m) => ({ ...m, pending: false, status: null }));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chat failed');
        patchAssistant((m) => ({ ...m, pending: false, status: null }));
      } finally {
        setIsStreaming(false);
      }
    },
    [ensureSession, isStreaming],
  );

  return { messages, isStreaming, error, send, reset };
}
