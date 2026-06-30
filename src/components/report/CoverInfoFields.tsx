"use client";

import type { CoverInfo } from "@/types/report";

interface Props {
  value: CoverInfo;
  onChange: (next: CoverInfo) => void;
  disabled?: boolean;
}

type Field = { key: keyof CoverInfo; label: string; placeholder?: string };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Project",
    fields: [
      { key: "project_name", label: "Project name", placeholder: "Defaults to the analysis name" },
      { key: "client_ref", label: "Client / reference" },
    ],
  },
  {
    title: "Sponsor",
    fields: [
      { key: "sponsor_name", label: "Name" },
      { key: "sponsor_contact", label: "Contact" },
      { key: "sponsor_email", label: "Email" },
      { key: "sponsor_address", label: "Address" },
    ],
  },
  {
    title: "Test facility",
    fields: [
      { key: "test_facility_name", label: "Name", placeholder: "Defaults to institute name" },
      { key: "test_facility_contact", label: "Contact" },
      { key: "test_facility_email", label: "Email" },
      { key: "test_facility_address", label: "Address" },
    ],
  },
  {
    title: "Test site",
    fields: [
      { key: "test_site_name", label: "Name", placeholder: "Defaults to institute name" },
      { key: "test_site_contact", label: "Contact" },
      { key: "test_site_email", label: "Email" },
      { key: "test_site_address", label: "Address" },
    ],
  },
  {
    title: "Signatures",
    fields: [
      { key: "prepared_by", label: "Prepared by" },
      { key: "checked_by", label: "Checked by" },
      { key: "approved_by", label: "Approved by" },
    ],
  },
  {
    title: "Contact (contact back page)",
    fields: [
      { key: "contact_email", label: "Contact email" },
      { key: "contact_phone", label: "Contact phone" },
    ],
  },
];

export default function CoverInfoFields({ value, onChange, disabled }: Props) {
  const set = (key: keyof CoverInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                <input
                  type="text"
                  value={value[f.key] ?? ""}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                  disabled={disabled}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
