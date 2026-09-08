'use client';

import { Search } from 'lucide-react';

interface DocsSearchProps {
  value: string;
  onChange: (value: string) => void;
  count: number;
}

/** Champ de filtre de l'index de documentation. */
export default function DocsSearch({ value, onChange, count }: DocsSearchProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: 'var(--text-muted)' }}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Search ${count} guides…`}
        aria-label="Search the documentation"
        className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--sl-purple)]"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}
