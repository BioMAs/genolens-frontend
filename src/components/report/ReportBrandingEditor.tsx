"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Check, FileText } from "lucide-react";
import {
  useReportSettings,
  useReportLogo,
  useUpdateReportSettings,
  useUploadReportLogo,
} from "@/hooks/useReportSettings";
import type { ReportSettings } from "@/types/report";

const DEFAULT_PRIMARY = "#003C65";
const DEFAULT_SECONDARY = "#42E2BA";

const DEMO_SETTINGS: ReportSettings = {
  logo_path: null,
  institute_name: "Your Institute",
  institute_address: "123 Science Park, City",
  primary_color: "#1E3A8A",
  secondary_color: "#10B981",
  default_materials_methods:
    "Samples were sequenced and analysed following standard transcriptomics protocols…",
  default_conclusion: "These results highlight the key biological signals of the comparison…",
};

interface Props {
  /** Demo mode: sample data, no API calls (used behind the locked overlay). */
  demo?: boolean;
}

/** Outer component: resolves settings, then mounts the form once with initial values. */
export default function ReportBrandingEditor({ demo = false }: Props) {
  const { data: fetched, isLoading } = useReportSettings(!demo);
  const settings = demo ? DEMO_SETTINGS : fetched;

  if (!demo && isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Remount (via key) only on the loading→loaded transition so the form
  // initialises once from server data without setState-in-effect.
  return <EditorForm key={demo ? "demo" : settings ? "loaded" : "loading"} demo={demo} settings={settings} />;
}

function EditorForm({ demo, settings }: { demo: boolean; settings?: ReportSettings }) {
  const update = useUpdateReportSettings();
  const uploadLogo = useUploadReportLogo();
  const { data: persistedLogoUrl } = useReportLogo(!demo, settings?.logo_path);
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    institute_name: settings?.institute_name ?? "",
    institute_address: settings?.institute_address ?? "",
    primary_color: settings?.primary_color ?? DEFAULT_PRIMARY,
    secondary_color: settings?.secondary_color ?? DEFAULT_SECONDARY,
    default_materials_methods: settings?.default_materials_methods ?? "",
    default_conclusion: settings?.default_conclusion ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);

  const logoPreviewUrl = selectedLogoUrl ?? persistedLogoUrl ?? null;
  const logoIsPdf =
    !selectedLogoUrl && !!settings?.logo_path && settings.logo_path.toLowerCase().endsWith(".pdf");

  const handleSave = async () => {
    if (demo) return;
    setSaved(false);
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || demo) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setSelectedLogoUrl(null);
    }
    uploadLogo.mutate(file);
  };

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
          <FileText className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Report customization</h3>
          <p className="text-sm text-gray-500">Branding applied to every PDF report you generate.</p>
        </div>
      </div>

      {/* Live preview of the report header */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Preview</label>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-center justify-between p-4" style={{ background: form.primary_color }}>
            {logoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreviewUrl} alt="logo" className="h-10 max-w-[160px] object-contain" />
            ) : (
              <span className="text-sm font-semibold text-white/90">
                {form.institute_name || "Your logo"}
              </span>
            )}
            <span className="text-xs font-medium uppercase tracking-wide text-white/80">
              Transcriptomics Report
            </span>
          </div>
          <div className="h-1.5 w-full" style={{ background: form.secondary_color }} />
          <div className="bg-white px-4 py-3">
            <div className="text-lg font-bold text-gray-900">{form.institute_name || "Institute name"}</div>
            <div className="text-xs text-gray-500">{form.institute_address || "Institute address"}</div>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleLogoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploadLogo.isPending || demo}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload logo
          </button>
          {logoIsPdf && <span className="text-xs text-gray-500">PDF logo uploaded</span>}
          <span className="text-xs text-gray-400">PNG, JPG or PDF · max 5 MB</span>
        </div>
      </div>

      {/* Colours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Primary colour</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={set("primary_color")} className="h-9 w-12 rounded" />
            <input
              type="text"
              value={form.primary_color}
              onChange={set("primary_color")}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Secondary colour</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.secondary_color} onChange={set("secondary_color")} className="h-9 w-12 rounded" />
            <input
              type="text"
              value={form.secondary_color}
              onChange={set("secondary_color")}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Institute */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Institute name</label>
          <input
            type="text"
            value={form.institute_name}
            onChange={set("institute_name")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Institute address</label>
          <input
            type="text"
            value={form.institute_address}
            onChange={set("institute_address")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Defaults */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Default Material &amp; Methods</label>
        <textarea
          value={form.default_materials_methods}
          onChange={set("default_materials_methods")}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Default conclusion</label>
        <textarea
          value={form.default_conclusion}
          onChange={set("default_conclusion")}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending || demo}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save settings
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </div>
  );
}
