"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type {
  ComparisonReportTriggerPayload,
  ReportJob,
  ReportTriggerResponse,
} from "@/types/report";

const POLL_MS = 3000;

export function useReportStatus(analysisId: string, enabled: boolean) {
  return useQuery<ReportJob>({
    queryKey: ["report", analysisId, "status"],
    queryFn: async () => {
      const res = await api.get<ReportJob>(`/analyses/${analysisId}/report/status`);
      return res.data;
    },
    enabled: enabled && !!analysisId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "RUNNING" ? POLL_MS : false;
    },
    staleTime: 0,
    retry: (count, error: unknown) => {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 404) return false;
      return count < 2;
    },
  });
}

export function useTriggerReport(analysisId: string) {
  const queryClient = useQueryClient();
  return useMutation<ReportTriggerResponse, Error>({
    mutationFn: async () => {
      const res = await api.post<ReportTriggerResponse>(`/analyses/${analysisId}/report`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", analysisId, "status"] });
    },
  });
}

// ── Comparison-scoped report (the primary scope) ────────────────────────────

export function useComparisonReportStatus(
  datasetId: string,
  comparisonName: string,
  enabled: boolean,
) {
  return useQuery<ReportJob>({
    queryKey: ["report", "comparison", datasetId, comparisonName, "status"],
    queryFn: async () => {
      const res = await api.get<ReportJob>(`/datasets/${datasetId}/report/status`, {
        params: { comparison_name: comparisonName },
      });
      return res.data;
    },
    enabled: enabled && !!datasetId && !!comparisonName,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "RUNNING" ? POLL_MS : false;
    },
    staleTime: 0,
    retry: (count, error: unknown) => {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 404) return false;
      return count < 2;
    },
  });
}

export function useTriggerComparisonReport(datasetId: string, comparisonName: string) {
  const queryClient = useQueryClient();
  return useMutation<ReportTriggerResponse, Error, ComparisonReportTriggerPayload | void>({
    mutationFn: async (payload) => {
      const res = await api.post<ReportTriggerResponse>(
        `/datasets/${datasetId}/report`,
        payload ?? {},
        { params: { comparison_name: comparisonName } },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["report", "comparison", datasetId, comparisonName, "status"],
      });
    },
  });
}
