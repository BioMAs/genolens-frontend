"use client";

import type { FirstPageType, LastPageType } from "@/types/report";

const FIRST_PAGES: { value: FirstPageType; label: string; desc: string }[] = [
  { value: "detailed", label: "Detailed", desc: "Full title page with sponsor, test facility/site and signature blocks." },
  { value: "simple", label: "Simple", desc: "Compact title + project, version, date and author. No regulatory blocks." },
  { value: "cover", label: "Cover", desc: "Full-page coloured cover (logo + title), then the detailed info page." },
];

const LAST_PAGES: { value: LastPageType; label: string; desc: string }[] = [
  { value: "color", label: "Colour back cover", desc: "Full secondary-colour page with logo and tagline." },
  { value: "contact", label: "Contact page", desc: "Plain page with logo, institute, address and contact details." },
];

interface Props {
  firstPageType: FirstPageType;
  lastPageType: LastPageType;
  onChange: (patch: { first_page_type?: FirstPageType; last_page_type?: LastPageType }) => void;
  disabled?: boolean;
}

function Card({
  active,
  label,
  desc,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
        active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className="mt-0.5 text-xs text-gray-500">{desc}</div>
    </button>
  );
}

export default function PageModelSelector({ firstPageType, lastPageType, onChange, disabled }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">First page</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {FIRST_PAGES.map((p) => (
            <Card
              key={p.value}
              active={firstPageType === p.value}
              label={p.label}
              desc={p.desc}
              disabled={disabled}
              onClick={() => onChange({ first_page_type: p.value })}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Last page</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {LAST_PAGES.map((p) => (
            <Card
              key={p.value}
              active={lastPageType === p.value}
              label={p.label}
              desc={p.desc}
              disabled={disabled}
              onClick={() => onChange({ last_page_type: p.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
