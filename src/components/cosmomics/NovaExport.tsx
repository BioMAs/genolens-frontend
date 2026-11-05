'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import { exportChartPng, exportChartSvg } from '@/utils/chartExport';
import { useIsDemoAccount } from '@/hooks/useIsDemoAccount';
import { HatchPattern, NOVA_FONT, NovaGraphic } from './CosmOmicsNova';
import { LEGEND_NOTES, NovaLegendSvg, legendHeight } from './NovaLegend';
import { UNLINKED_TERMS_DRAWN, layoutNova, type NovaLayout } from './novaLayout';
import { NOVA_INK } from './novaPalette';
import { provenanceLines, wrapNote } from './novaText';

/** Width of the exported figure, as the reference flyer (1000 × 1030). */
export const EXPORT_WIDTH = 1000;
const HEADER_BOTTOM = 120;
const LOGO_URL = '/cosmomics/logo_scilicium.png';

let logoRequest: Promise<string> | null = null;

/** The SciLicium logo as a data URI: an SVG rasterised to PNG cannot fetch an external image. */
export function loadLogoDataUrl(): Promise<string> {
  logoRequest ??= fetch(LOGO_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`logo ${res.status}`);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch((err) => {
      logoRequest = null;
      throw err;
    });
  return logoRequest;
}

export interface NovaExportFigureProps {
  data: CosmOmicsNovaData;
  seed: string;
  /** Logo as a data URI; the "SciLicium" wordmark is written instead when absent. */
  logoHref?: string;
  /** An extra last line: what the figure is not (bench marking), or a note of the caller's. */
  footer?: string;
}

/**
 * What the figure says under the legend, one string per sentence: what the numbers
 * mean, which claims were not evaluated, how much of the not-linked sector is drawn,
 * what the nova was computed from, and the caller's own line.
 */
function exportNotes(data: CosmOmicsNovaData, layout: NovaLayout, footer?: string): string[] {
  const { total, drawn, termsCapped } = layout.unlinked;
  return [
    ...LEGEND_NOTES,
    ...(data.not_evaluated?.length ? [`Not evaluated: ${data.not_evaluated.join(', ')}`] : []),
    ...(total
      ? [
          `${drawn} of ${total} not-linked sub-groups drawn, strongest first` +
            (termsCapped ? ` · each shows its ${UNLINKED_TERMS_DRAWN} strongest terms at most` : ''),
        ]
      : []),
    ...provenanceLines(data),
    ...(footer ? [footer] : []),
  ].flatMap((note) => wrapNote(note));
}

/**
 * The exported figure: "CosmOmics by SciLicium" header with the contrast, the
 * nova in the reference frame, the reference legend and what the nova was
 * computed from at the bottom. Only data is drawn: no decorative dots.
 */
export const NovaExportFigure = forwardRef<SVGSVGElement, NovaExportFigureProps>(function NovaExportFigure(
  { data, seed, logoHref, footer },
  ref,
) {
  const layout = useMemo(() => layoutNova(data, { seed, showDust: false }), [data, seed]);
  const notes = useMemo(() => exportNotes(data, layout, footer), [data, layout, footer]);
  // Labels pushed upwards by many narrow sectors must not run into the header.
  const shift = Math.max(0, HEADER_BOTTOM - layout.bounds.y);
  const legendY = Math.ceil(layout.bounds.y + layout.bounds.height + shift) + 40;
  const height = Math.max(1030, legendY + legendHeight(notes.length) + 24);
  const hatchId = 'cosmomics-export-hatch';
  const logoW = 170;
  const logoH = (logoW * 190) / 1024;
  const contrast = data.contrast.length > 70 ? `${data.contrast.slice(0, 69)}…` : data.contrast;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={EXPORT_WIDTH}
      height={height}
      viewBox={`0 0 ${EXPORT_WIDTH} ${height}`}
    >
      <defs>
        <HatchPattern id={hatchId} />
      </defs>
      {/* The font sits on a group, not on <svg>: the shared exporter keeps only the
          children of the root element, so a root font-family would be dropped. */}
      <g fontFamily={NOVA_FONT}>
        <rect width={EXPORT_WIDTH} height={height} fill={NOVA_INK.background} />
        <text x={50} y={72} fontSize={46} fontWeight={700} letterSpacing={-0.5}>
          <tspan fill={NOVA_INK.core}>Cosm</tspan>
          <tspan fill={NOVA_INK.green}>Omics</tspan>
        </text>
        <text x={950 - logoW - 8} y={72} fontSize={15} fill={NOVA_INK.muted} textAnchor="end">
          by
        </text>
        {logoHref ? (
          <image x={950 - logoW} y={72 - logoH + 4} width={logoW} height={logoH} href={logoHref} />
        ) : (
          <text x={950} y={72} fontSize={30} fontWeight={600} fill={NOVA_INK.core} textAnchor="end">
            SciLicium
          </text>
        )}
        <text x={50} y={104} fontSize={16} fill={NOVA_INK.muted}>
          {`Pathway nova · ${contrast} · further out = more significant`}
        </text>
        <g transform={shift ? `translate(0, ${shift})` : undefined}>
          <NovaGraphic layout={layout} hatchId={hatchId} />
        </g>
        <NovaLegendSvg y={legendY} hatchId={hatchId} notes={notes} />
      </g>
    </svg>
  );
});

interface UseNovaExport {
  data: CosmOmicsNovaData;
  seed: string;
  filename: string;
  footer?: string;
}

/**
 * Export in two steps: mount the figure off-screen, then hand its `<svg>` to the
 * shared chart exporter (fonts embedded, demo watermark, PNG at ×3). The export is
 * marked DEMO when the viewing account is a demo one, or when the dataset itself is a
 * demonstration dataset (`provenance.demo`): the mark follows the data, not only the viewer.
 */
export function useNovaExport({ data, seed, filename, footer }: UseNovaExport): {
  run: (kind: 'svg' | 'png') => Promise<void>;
  busy: boolean;
  figure: ReactNode;
} {
  const demoAccount = useIsDemoAccount();
  const demo = demoAccount || data.provenance?.demo === true;
  const ref = useRef<SVGSVGElement>(null);
  const [job, setJob] = useState<{ kind: 'svg' | 'png'; logo?: string } | null>(null);

  useEffect(() => {
    if (!job || !ref.current) return;
    const svg = ref.current;
    const opts = { filename, background: NOVA_INK.background, demo };
    (job.kind === 'png' ? exportChartPng(svg, { ...opts, scale: 3 }) : exportChartSvg(svg, opts))
      .catch((err) => console.error('CosmOmics export failed', err))
      .finally(() => setJob(null));
  }, [job, filename, demo]);

  const run = useCallback(
    async (kind: 'svg' | 'png') => {
      if (job) return;
      const logo = await loadLogoDataUrl().catch(() => undefined);
      setJob({ kind, logo });
    },
    [job],
  );

  const figure = job ? (
    <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: EXPORT_WIDTH, pointerEvents: 'none' }}>
      <NovaExportFigure ref={ref} data={data} seed={seed} logoHref={job.logo} footer={footer} />
    </div>
  ) : null;

  return { run, busy: !!job, figure };
}
