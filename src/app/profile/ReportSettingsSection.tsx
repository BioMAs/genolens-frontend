"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Lock, Loader2, Upload, Check } from "lucide-react";
import { useUserProfile } from "@/hooks/useCosmetics";
import {
  useReportSettings,
  useUpdateReportSettings,
  useUploadReportLogo,
} from "@/hooks/useReportSettings";

export default function ReportSettingsSection() {
  const { data: profile } = useUserProfile();
  const unlocked = profile?.has_report_customization === true;

  const { data: settings } = useReportSettings(unlocked);
  const update = useUpdateReportSettings();
  const uploadLogo = useUploadReportLogo();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    institute_name: "",
    institute_address: "",
    primary_color: "#003C65",
    secondary_color: "#42E2BA",
    default_materials_methods: "",
    default_conclusion: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        institute_name: settings.institute_name ?? "",
        institute_address: settings.institute_address ?? "",
        primary_color: settings.primary_color ?? "#003C65",
        secondary_color: settings.secondary_color ?? "#42E2BA",
        default_materials_methods: settings.default_materials_methods ?? "",
        default_conclusion: settings.default_conclusion ?? "",
      });
    }
  }, [settings]);

  if (!profile) return null;

  if (!unlocked) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Report customization</h3>
            <p className="text-sm text-gray-500">
              Brand your PDF reports with your logo, colours and institute, and edit the
              conclusion / Material &amp; Methods. Contact your administrator to unlock this
              module.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaved(false);
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo.mutate(file);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
          <FileText className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Report customization</h3>
          <p className="text-sm text-gray-500">Branding applied to every generated report.</p>
        </div>
      </div>

      {/* Logo */}
      <div className="mb-5">
        <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
        <div className="flex items-center gap-3">
          {settings?.logo_path && (
            <span className="text-xs text-gray-500">Current: {settings.logo_path.split("/").pop()}</span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleLogoChange}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploadLogo.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {uploadLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload logo
          </button>
        </div>
      </div>

      {/* Institute */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Colours */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Primary colour</label>
          <input type="color" value={form.primary_color} onChange={set("primary_color")} className="h-9 w-16 rounded" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Secondary colour</label>
          <input type="color" value={form.secondary_color} onChange={set("secondary_color")} className="h-9 w-16 rounded" />
        </div>
      </div>

      {/* Defaults */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Default Material &amp; Methods</label>
        <textarea
          value={form.default_materials_methods}
          onChange={set("default_materials_methods")}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="mb-5">
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
          onClick={handleSave}
          disabled={update.isPending}
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
