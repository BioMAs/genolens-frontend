"use client";

import { useState } from "react";
import { FileText, Loader2, Download, AlertCircle, RefreshCw, Lock } from "lucide-react";
import { useReportStatus, useTriggerReport } from "@/hooks/useReportGeneration";
import api from "@/utils/api";
import { useUserProfile } from "@/hooks/useUserProfile";
import { canExportAdvanced } from "@/utils/plan";

interface Props {
  analysisId: string;
}

export default function GenerateReportButton({ analysisId }: Props) {
  const [hasTriggered, setHasTriggered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: profile } = useUserProfile();
  const canExport = canExportAdvanced(profile);

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
        className="inline-flex items-center gap-2 rounded-control bg-success px-4 py-2
 text-body-sm font-medium text-on-accent transition-colors hover:bg-success-hover
 disabled:opacity-50"
      >
        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isDownloading ? "Downloading…" : "Download Report"}
      </button>
    );
  }

  // After isDone on purpose: an already-generated report stays downloadable.
  // Mirrors the backend, which gates the two report *triggers* and leaves
  // /report/status and /report/download open, so a plan change never hides a
  // report that was already produced.
  if (!canExport) {
    return (
      <button
        type="button"
        disabled
        title="PDF reports require a Pro or Enterprise plan"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-control
 bg-accent px-4 py-2 text-body-sm font-medium text-on-accent opacity-50"
      >
        <Lock className="h-4 w-4" />
        Generate Report
      </button>
    );
  }

  if (isFailed) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-control bg-danger-soft px-4 py-2
 text-body-sm font-medium text-danger-ink transition-colors hover:bg-danger-hover"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Report
        </button>
        {job?.error_message && (
          <span className="flex items-center gap-1 text-caption text-danger-ink">
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
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-control
 bg-accent-soft px-4 py-2 text-body-sm font-medium text-accent-ink"
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
      className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2
 text-body-sm font-medium text-on-accent transition-colors hover:bg-accent-hover
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
