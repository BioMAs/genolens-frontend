'use client';

import { useId, useState } from 'react';
import { Download, FileCode2, FileImage, Loader2 } from 'lucide-react';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import { OverflowMenu } from '@/components/ui/menu';
import CosmOmicsNova from './CosmOmicsNova';
import NovaClaimCard, { NovaClaimList } from './NovaClaimCard';
import NovaDataTable from './NovaDataTable';
import NovaLegend from './NovaLegend';
import { useNovaExport } from './NovaExport';

interface Props {
  data: CosmOmicsNovaData;
  /** Seed of the decorative jitter: dataset id + comparison, so a dataset always looks the same. */
  seed: string;
  /** Exported file name, without extension. */
  filename: string;
  /** Bottom-right line of the exported figure. */
  footer?: string;
}

/**
 * The CosmOmics module body: nova, side claim card, legend, data table, export.
 * Presentational — the data comes from the caller (API hook, or a fixture on the
 * check page).
 */
export default function CosmOmicsNovaView({ data, seed, filename, footer }: Props) {
  const [showDust, setShowDust] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const hatchId = `nova-legend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // The strongest claim is open until the user picks another one.
  const selected = data.claims.find((c) => c.name === picked) ?? data.claims[0] ?? null;
  const exporter = useNovaExport({
    data,
    seed,
    showDust,
    filename,
    footer: footer ?? `${data.contrast} · adjusted p (Benjamini–Hochberg) · GenoLens`,
  });
  const unlinked = data.unlinked_total ?? data.unlinked.length;

  return (
    <div className="space-y-4" data-cosmomics-view>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-secondary">
          <span className="font-semibold text-primary">{data.contrast}</span>
          {' · '}
          {data.claims.length} claim{data.claims.length === 1 ? '' : 's'} with a significant pathway
          {' · '}
          {unlinked} pathway{unlinked === 1 ? '' : 's'} not linked to a claim
        </p>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-caption text-secondary">
            <input
              type="checkbox"
              checked={showDust}
              onChange={(e) => setShowDust(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Background dust
          </label>
          {exporter.busy ? (
            <span className="inline-flex h-8 w-8 items-center justify-center" aria-label="Exporting">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          ) : (
            <OverflowMenu
              label="Export nova"
              icon={<Download className="h-4 w-4" />}
              items={[
                {
                  label: 'Download PNG (×3)',
                  icon: <FileImage className="h-3.5 w-3.5 shrink-0" />,
                  onSelect: () => void exporter.run('png'),
                },
                {
                  label: 'Download SVG',
                  icon: <FileCode2 className="h-3.5 w-3.5 shrink-0" />,
                  onSelect: () => void exporter.run('svg'),
                },
              ]}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <figure className="nova-paper m-0 min-w-0 rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] p-2 sm:p-4">
          <CosmOmicsNova
            data={data}
            seed={seed}
            showDust={showDust}
            selectedClaim={selected?.name ?? null}
            onSelectClaim={setPicked}
          />
          <figcaption className="sr-only">
            One sector per claim, width proportional to its importance; bubbles are pathway sub-groups,
            further out is more significant. The data table below lists every value.
          </figcaption>
        </figure>

        <aside
          className="nova-paper space-y-4 rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] p-4"
          aria-live="polite"
          aria-label="Claim details"
        >
          {selected ? (
            <NovaClaimCard claim={selected} />
          ) : (
            <p className="text-[13px] text-[var(--nova-ink-muted)]">No claim has a significant pathway in this comparison.</p>
          )}
          {data.claims.length > 1 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--nova-ink-subtle)]">All claims</p>
              <NovaClaimList claims={data.claims} selected={selected?.name ?? null} onSelect={setPicked} />
            </div>
          )}
          <p className="text-[11.5px] leading-snug text-[var(--nova-ink-subtle)]">
            Click a sector or a claim to read its card. Hover a bubble for the ontology terms behind it.
          </p>
        </aside>
      </div>

      <div className="nova-paper rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] px-4 py-3">
        <NovaLegend hatchId={hatchId} />
      </div>

      <NovaDataTable data={data} />
      {exporter.figure}
    </div>
  );
}
