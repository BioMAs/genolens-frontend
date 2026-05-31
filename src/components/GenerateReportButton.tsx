"use client";

import { useState } from "react";
import { FileText, Loader2, Download, AlertCircle, RefreshCw } from "lucide-react";
import { useReportStatus, useTriggerReport } from "@/hooks/useReportGeneration";

interface Props {
  projectId: string;
}

export default function GenerateReportButton({ projectId }: Props) {
  const [hasTriggered, setHasTriggered] = useState(false);

  const trigger = useTriggerReport(projectId);
  const { data: job } = useReportStatus(projectId, hasTriggered);

  const isDone = job?.status === "DONE";
  const isFailed = job?.status === "FAILED";
  const isRunning = job?.status === "PENDING" || job?.status === "RUNNING";

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";
  const downloadUrl = isDone
    ? `${apiBase}/projects/${projectId}/report/download`
    : null;

  const handleGenerate = () => {
    setHasTriggered(true);
    trigger.mutate();
  };

  if (isDone && downloadUrl) {
    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2
                   text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        <Download className="h-4 w-4" />
        Download Report
      </a>
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
