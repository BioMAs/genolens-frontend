'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

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
    staleTime: 0,
  });

  const messages: ChatMessage[] = historyData?.messages ?? [];

  const interpret = async (forceRegenerate = false) => {
    setIsInterpreting(true);
    try {
      const resp = await api.post(`/datasets/${datasetId}/ai/interpret`, {
        chart_type: chartType,
        context,
        context_key: contextKey,
        force_regenerate: forceRegenerate,
      });
      setInterpretation(resp.data.interpretation);
    } finally {
      setIsInterpreting(false);
    }
  };

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const resp = await api.post(`/datasets/${datasetId}/ai/ask`, {
        chart_type: chartType,
        context_key: contextKey,
        question,
        context,
      });
      return resp.data as { answer: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chart-ai-conversations', datasetId, chartType, contextKey],
      });
    },
  });

  return {
    interpretation,
    messages,
    isInterpreting,
    isAsking: askMutation.isPending,
    interpret,
    ask: askMutation.mutateAsync,
  };
}
