"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { ReportSettings } from "@/types/report";

const KEY = ["report-settings", "me"];

/**
 * Persistent per-user report branding settings. Gated behind the report
 * customization module — the API returns 403 when the module is locked, so
 * `enabled` should only be true once the profile confirms access.
 */
export function useReportSettings(enabled: boolean) {
  return useQuery<ReportSettings>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<ReportSettings>("/users/me/report-settings");
      return res.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: (count, error: unknown) => {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 403) return false;
      return count < 1;
    },
  });
}

export function useUpdateReportSettings() {
  const queryClient = useQueryClient();
  return useMutation<ReportSettings, Error, Partial<ReportSettings>>({
    mutationFn: async (payload) => {
      const res = await api.put<ReportSettings>("/users/me/report-settings", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
    },
  });
}

export function useUploadReportLogo() {
  const queryClient = useQueryClient();
  return useMutation<ReportSettings, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<ReportSettings>("/users/me/report-settings/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
    },
  });
}
