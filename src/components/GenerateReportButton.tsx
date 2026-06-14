"use client";

import { useState } from "react";
import { FileText, Loader2, Download, AlertCircle, RefreshCw } from "lucide-react";
import { useReportStatus, useTriggerReport } from "@/hooks/useReportGeneration";
import api from "@/utils/api";

interface Props {
  analysisId: string;
}

export default function GenerateReportButton({ analysisId }: Props) {
  const [hasTriggered, setHasTriggered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const trigger = useTriggerReport(analysisId);
  // Always enabled so we show DONE/RUNNING state even after page reload
  const { data: job } = useReportStatus(analysisId, true);

  const isDone = job?.status === "DONE";
  const isFailed = job?.status === "FAILED";
  const isRunning = job?.status === "PENDING" || job?.status === "RUNNING";

  const handleGenerate = () => {
    setHasTriggered(true);
    trigger.mutate();
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get(`/analyses/${analysisId}/report/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${analysisId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isDone) {
    return (
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2
                   text-sm font-medium text-white transition-colors hover:bg-green-700
                   disabled:opacity-50"
      >
        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isDownloading ? "Downloading…" : "Download Report"}
      </button>
    );
  }

  if (isFailed) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2
                     text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Report
        </button>
        {job?.error_message && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            {job.error_message}
          </span>
        )}
      </div>
    );
  }

  if (isRunning) {
    return (
      <button
        disabled
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg
                   bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating Report…
      </button>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={trigger.isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2
                 text-sm font-medium text-white transition-colors hover:bg-indigo-700
                 disabled:opacity-50"
    >
      {trigger.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      Generate Report
    </button>
  );
}
