'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

export type ChartType = 'volcano' | 'pca' | 'umap' | 'heatmap' | 'enrichment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface UseChartAIOptions {
  datasetId: string;
  chartType: ChartType;
  contextKey: string;
  context: Record<string, unknown>;
  enabled?: boolean;
}

/** Read SSE stream from a POST endpoint and yield each parsed JSON event. */
async function* readSSE(
  url: string,
  body: Record<string, unknown>,
  token?: string,
): AsyncGenerator<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    let detail = '';
    try {
      const errBody = await response.text();
      detail = errBody ? ` – ${errBody}` : '';
    } catch { /* ignore */ }
    throw new Error(`AI request failed: ${response.status}${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}

export function useChartAI({
  datasetId,
  chartType,
  contextKey,
  context,
  enabled = false,
}: UseChartAIOptions) {
  const queryClient = useQueryClient();
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  // Load conversation history when panel opens
  const { data: historyData } = useQuery({
    queryKey: ['chart-ai-conversations', datasetId, chartType, contextKey],
    queryFn: async () => {
      const resp = await api.get(`/datasets/${datasetId}/ai/conversations`, {
        params: { chart_type: chartType, context_key: contextKey },
      });
      return resp.data as { messages: ChatMessage[] };
    },
    enabled,
    staleTime: 60_000,
  });

  const messages: ChatMessage[] = historyData?.messages ?? [];

  const interpret = async (forceRegenerate = false) => {
    setIsInterpreting(true);
    setInterpretation('');
    setInterpretError(null);
    try {
      // Retrieve current auth token directly from Supabase session for SSE fetch
      const { data: { session } } = await createClient().auth.getSession();
      const token = session?.access_token;

      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/$/, '');
      const url = `${apiBase}/datasets/${datasetId}/ai/interpret-stream`;

      let accumulated = '';
      for await (const event of readSSE(url, {
        chart_type: chartType,
        context,
        context_key: contextKey,
        force_regenerate: forceRegenerate,
      }, token)) {
        if (event.error) {
          throw new Error(event.error as string);
        }
        if (event.text) {
          accumulated += event.text as string;
          setInterpretation(accumulated);
        }
        if (event.done) break;
      }
    } catch (err) {
      setInterpretError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsInterpreting(false);
    }
  };

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const { data: { session } } = await createClient().auth.getSession();
      const token = session?.access_token;

      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/$/, '');
      const url = `${apiBase}/datasets/${datasetId}/ai/ask-stream`;

      let answer = '';
      for await (const event of readSSE(url, {
        chart_type: chartType,
        context_key: contextKey,
        question,
        context,
      }, token)) {
        if (event.error) throw new Error(event.error as string);
        if (event.text) answer += event.text as string;
        if (event.done) break;
      }
      return { answer };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chart-ai-conversations', datasetId, chartType, contextKey],
      });
    },
  });

  return {
    interpretation,
    interpretError,
    messages,
    isInterpreting,
    isAsking: askMutation.isPending,
    interpret,
    ask: (question: string) => askMutation.mutateAsync(question),
  };
}

