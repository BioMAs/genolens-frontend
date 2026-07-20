"use client";

import type { FirstPageType, LastPageType } from "@/types/report";

const DEFAULT_PRIMARY = "#003C65";
const DEFAULT_SECONDARY = "#42E2BA";

interface Props {
  firstPageType: FirstPageType;
  lastPageType: LastPageType;
  onChange: (patch: { first_page_type?: FirstPageType; last_page_type?: LastPageType }) => void;
  disabled?: boolean;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/* ---- Mini A4 page mock-ups (viewBox 70 x 99) ------------------------------- */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 70 99" className="h-24 w-auto" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="69" height="98" rx="3" fill="#ffffff" stroke="#d1d5db" />
      {children}
    </svg>
  );
}

const G = "#cbd5e1"; // neutral content lines

function ThumbDetailed({ p }: { p: string }) {
  return (
    <Page>
      <rect x="8" y="8" width="20" height="7" rx="1.5" fill={p} />
      <rect x="8" y="22" width="40" height="3" rx="1.5" fill={p} />
      {[30, 37, 44, 51, 58, 65].map((y) => (
        <rect key={y} x="8" y={y} width="54" height="2.4" rx="1.2" fill={G} />
      ))}
      <rect x="8" y="80" width="22" height="12" rx="1.5" fill="none" stroke={G} />
      <rect x="40" y="80" width="22" height="12" rx="1.5" fill="none" stroke={G} />
    </Page>
  );
}

function ThumbSimple({ p }: { p: string }) {
  return (
    <Page>
      <rect x="8" y="8" width="14" height="5" rx="1.5" fill={p} />
      <rect x="14" y="34" width="42" height="6" rx="1.5" fill={p} />
      <rect x="20" y="44" width="30" height="3" rx="1.5" fill={G} />
      <rect x="8" y="78" width="24" height="2.6" rx="1.3" fill={G} />
      <rect x="8" y="84" width="24" height="2.6" rx="1.3" fill={G} />
    </Page>
  );
}

function ThumbCover({ p }: { p: string }) {
  return (
    <Page>
      <rect x="1.5" y="1.5" width="67" height="96" rx="2.5" fill={p} />
      <circle cx="35" cy="38" r="9" fill="#ffffff" opacity="0.92" />
      <rect x="18" y="56" width="34" height="6" rx="2" fill="#ffffff" opacity="0.95" />
      <rect x="24" y="66" width="22" height="3.5" rx="1.5" fill="#ffffff" opacity="0.7" />
    </Page>
  );
}

function ThumbColor({ s }: { s: string }) {
  return (
    <Page>
      <rect x="1.5" y="1.5" width="67" height="96" rx="2.5" fill={s} />
      <circle cx="35" cy="42" r="10" fill="#ffffff" opacity="0.92" />
      <rect x="22" y="60" width="26" height="4" rx="2" fill="#ffffff" opacity="0.85" />
    </Page>
  );
}

function ThumbContact({ p }: { p: string }) {
  return (
    <Page>
      <circle cx="35" cy="30" r="9" fill="none" stroke={p} strokeWidth="2" />
      <rect x="22" y="50" width="26" height="3.5" rx="1.5" fill={p} />
      {[58, 64, 70].map((y) => (
        <rect key={y} x="24" y={y} width="22" height="2.4" rx="1.2" fill={G} />
      ))}
    </Page>
  );
}

export default function PageModelSelector({
  firstPageType,
  lastPageType,
  onChange,
  disabled,
  primaryColor,
  secondaryColor,
}: Props) {
  const p = primaryColor || DEFAULT_PRIMARY;
  const s = secondaryColor || DEFAULT_SECONDARY;

  const firstPages: { value: FirstPageType; label: string; desc: string; thumb: React.ReactNode }[] = [
    { value: "detailed", label: "Detailed", desc: "Full title page with sponsor, test facility/site and signatures.", thumb: <ThumbDetailed p={p} /> },
    { value: "simple", label: "Simple", desc: "Compact title + project, version, date and author.", thumb: <ThumbSimple p={p} /> },
    { value: "cover", label: "Cover", desc: "Full-page coloured cover, then the detailed info page.", thumb: <ThumbCover p={p} /> },
  ];
  const lastPages: { value: LastPageType; label: string; desc: string; thumb: React.ReactNode }[] = [
    { value: "color", label: "Colour back cover", desc: "Full secondary-colour page with logo and tagline.", thumb: <ThumbColor s={s} /> },
    { value: "contact", label: "Contact page", desc: "Plain page with logo, institute and contact details.", thumb: <ThumbContact p={p} /> },
  ];

  const Card = ({
    active,
    label,
    desc,
    thumb,
    onClick,
  }: {
    active: boolean;
    label: string;
    desc: string;
    thumb: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
        active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="mb-2 flex justify-center rounded-md bg-gray-50 py-2">{thumb}</div>
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className="mt-0.5 text-xs text-gray-500">{desc}</div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">First page</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {firstPages.map((pg) => (
            <Card
              key={pg.value}
              active={firstPageType === pg.value}
              label={pg.label}
              desc={pg.desc}
              thumb={pg.thumb}
              onClick={() => onChange({ first_page_type: pg.value })}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Last page</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {lastPages.map((pg) => (
            <Card
              key={pg.value}
              active={lastPageType === pg.value}
              label={pg.label}
              desc={pg.desc}
              thumb={pg.thumb}
              onClick={() => onChange({ last_page_type: pg.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
