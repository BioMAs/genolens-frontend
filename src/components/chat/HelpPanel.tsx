'use client';

import { X } from 'lucide-react';

const EXAMPLE_COMMANDS = [
  'How many genes are up- vs down-regulated?',
  'Show me a volcano plot',
  'Histogram of log2 fold-changes',
  'Bar chart of the top 15 genes',
  'Which pathways are enriched?',
  'Make the last chart blue',
];

const CHART_TYPES: { name: string; desc: string }[] = [
  { name: 'Volcano', desc: 'log2 fold-change vs significance' },
  { name: 'Histogram', desc: 'distribution of a numeric field' },
  { name: 'MA plot', desc: 'mean expression vs fold-change' },
  { name: 'Gene bar chart', desc: 'top genes by |log2FC|' },
  { name: 'Regulation bar', desc: 'up vs down counts' },
  { name: 'Enrichment bar', desc: 'top enriched pathways' },
  { name: 'Scatter', desc: 'any two numeric fields' },
];

/** Collapsible right-hand help panel: example commands + supported chart types. */
export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Help</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
          aria-label="Close help"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Example commands
          </h4>
          <ul className="flex flex-col gap-1.5">
            {EXAMPLE_COMMANDS.map((cmd) => (
              <li
                key={cmd}
                className="rounded-md bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
              >
                “{cmd}”
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Charts the assistant understands
          </h4>
          <ul className="flex flex-col gap-1.5">
            {CHART_TYPES.map((c) => (
              <li key={c.name} className="text-xs text-[var(--text-primary)]">
                <span className="font-medium">{c.name}</span>
                <span className="text-[var(--text-muted)]"> — {c.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
