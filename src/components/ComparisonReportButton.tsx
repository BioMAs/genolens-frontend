"use client";

import { useState } from "react";
import { FileText, Loader2, Download, AlertCircle, RefreshCw, Settings2, X } from "lucide-react";
import {
  useComparisonReportStatus,
  useTriggerComparisonReport,
} from "@/hooks/useReportGeneration";
import { useReportSettings } from "@/hooks/useReportSettings";
import { useUserProfile } from "@/hooks/useCosmetics";
import api from "@/utils/api";

interface Props {
  datasetId: string;
  comparisonName: string;
}

export default function ComparisonReportButton({ datasetId, comparisonName }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [conclusion, setConclusion] = useState("");
  const [materialsMethods, setMaterialsMethods] = useState("");

  const { data: profile } = useUserProfile();
  const hasModule = profile?.has_report_customization === true;

  // Defaults pre-fill the editor (only fetched when the module is unlocked).
  const { data: settings } = useReportSettings(hasModule);

  const trigger = useTriggerComparisonReport(datasetId, comparisonName);
  const { data: job } = useComparisonReportStatus(datasetId, comparisonName, true);

  const isDone = job?.status === "DONE";
  const isFailed = job?.status === "FAILED";
  const isRunning = job?.status === "PENDING" || job?.status === "RUNNING";

  const openCustomizeModal = () => {
    setConclusion(settings?.default_conclusion ?? "");
    setMaterialsMethods(settings?.default_materials_methods ?? "");
    setShowModal(true);
  };

  const handleGenerate = () => {
    if (hasModule) {
      openCustomizeModal();
    } else {
      trigger.mutate();
    }
  };

  const handleGenerateWithCustomization = () => {
    trigger.mutate({
      conclusion: conclusion || undefined,
      materials_methods: materialsMethods || undefined,
    });
    setShowModal(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get(`/datasets/${datasetId}/report/download`, {
        params: { comparison_name: comparisonName },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${comparisonName}.pdf`;
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

  return (
    <>
      {renderButton()}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Customize report
              </h2>
              <button onClick={() => setShowModal(false)} aria-label="Close">
                <X className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
              Your saved logo, colours and institute are applied automatically. Edit the
              conclusion and Material &amp; Methods for this report below.
            </p>

            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Material &amp; Methods
            </label>
            <textarea
              value={materialsMethods}
              onChange={(e) => setMaterialsMethods(e.target.value)}
              rows={6}
              placeholder="Leave empty to use the default Material & Methods section."
              className="mb-4 w-full rounded-lg p-3 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)" }}
            />

            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Conclusion
            </label>
            <textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              rows={4}
              placeholder="Optional conclusion section."
              className="mb-5 w-full rounded-lg p-3 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)" }}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateWithCustomization}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <FileText className="h-4 w-4" /> Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  function renderButton() {
    if (isDone) {
      return (
        <div className="inline-flex items-center gap-2">
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
          <button
            onClick={handleGenerate}
            disabled={trigger.isPending}
            title="Regenerate with the latest branding and content"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2
                       text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {trigger.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </button>
        </div>
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
        ) : hasModule ? (
          <Settings2 className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {hasModule ? "Customize & Generate" : "Generate Report"}
      </button>
    );
  }
}
